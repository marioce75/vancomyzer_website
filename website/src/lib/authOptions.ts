import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  findUserByLogin,
  updateLastLogin,
  getSessionToken,
  incrementFailedLogins,
  resetFailedLogins,
  lockAccount,
  isAccountLocked,
  logSecurityEvent,
} from "@/lib/db";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MIN = 15;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = findUserByLogin(credentials.username);
        if (!user) {
          logSecurityEvent({
            action: "LOGIN_FAILED",
            username: credentials.username,
            details: JSON.stringify({ reason: "user_not_found" }),
            severity: "warn",
          });
          return null;
        }

        // Account lockout check (SOC 2 A2)
        if (isAccountLocked(user.id)) {
          logSecurityEvent({
            user_id: user.id,
            username: user.username,
            action: "LOGIN_LOCKED",
            details: JSON.stringify({ locked_until: user.locked_until }),
            severity: "warn",
          });
          throw new Error("LOCKED");
        }

        if (user.status === "pending") {
          throw new Error("PENDING");
        }
        if (user.status === "disabled") {
          throw new Error("DISABLED");
        }
        if (user.status !== "active") return null;

        // Verify password
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) {
          const attempts = incrementFailedLogins(user.id);
          logSecurityEvent({
            user_id: user.id,
            username: user.username,
            action: "LOGIN_FAILED",
            details: JSON.stringify({ attempt: attempts }),
            severity: "warn",
          });

          if (attempts >= LOCKOUT_THRESHOLD) {
            lockAccount(user.id, LOCKOUT_DURATION_MIN);
            logSecurityEvent({
              user_id: user.id,
              username: user.username,
              action: "ACCOUNT_LOCKED",
              details: JSON.stringify({ attempts, lockout_minutes: LOCKOUT_DURATION_MIN }),
              severity: "critical",
            });
          }
          return null;
        }

        // Successful login — reset failed attempts
        resetFailedLogins(user.id);

        const sessionToken = crypto.randomBytes(32).toString("hex");
        updateLastLogin(user.id, sessionToken);

        // Check if admin user needs MFA
        const mfaPending = user.role === "admin" && user.mfa_enabled === 1;

        logSecurityEvent({
          user_id: user.id,
          username: user.username,
          action: "LOGIN_SUCCESS",
          details: JSON.stringify({ role: user.role, mfa_pending: mfaPending }),
          severity: "info",
        });

        return {
          id: String(user.id),
          name: user.full_name,
          email: user.email,
          username: user.username,
          role: user.role,
          first_login_acknowledged: user.first_login_acknowledged,
          institution: user.institution,
          credentials: user.credentials,
          sessionToken,
          mfaPending,
          mfaVerified: false,
          mfaEnabled: user.mfa_enabled === 1,
          lastActivity: Date.now(),
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 14400, // 4 hours (clinical users); admins enforced at 60 min via lastActivity
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.id = u.id;
        token.username = u.username;
        token.role = u.role;
        token.first_login_acknowledged = u.first_login_acknowledged;
        token.institution = u.institution;
        token.credentials = u.credentials;
        token.sessionToken = u.sessionToken;
        token.mfaPending = u.mfaPending;
        token.mfaVerified = u.mfaVerified;
        token.mfaEnabled = u.mfaEnabled;
        token.lastActivity = u.lastActivity;
      }

      // Update lastActivity on every token refresh (session check)
      if (trigger === "update") {
        token.lastActivity = Date.now();
      }

      // Check if MFA was verified in the DB (set by the MFA verify endpoint)
      if (token.mfaPending && !token.mfaVerified && token.id) {
        try {
          const { findUserById } = require("@/lib/db");
          const dbUser = findUserById(Number(token.id));
          if (dbUser?.mfa_verified_at) {
            const verifiedAt = new Date(dbUser.mfa_verified_at).getTime();
            const loginTime = (token.lastActivity as number) || 0;
            // MFA was verified after login (within last 5 min)
            if (verifiedAt > loginTime - 300000) {
              token.mfaVerified = true;
              token.mfaPending = false;
            }
          }
        } catch { /* ignore */ }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).id = token.id;
        (session.user as Record<string, unknown>).username = token.username;
        (session.user as Record<string, unknown>).role = token.role;
        (session.user as Record<string, unknown>).first_login_acknowledged = token.first_login_acknowledged;
        (session.user as Record<string, unknown>).institution = token.institution;
        (session.user as Record<string, unknown>).credentials = token.credentials;
        (session.user as Record<string, unknown>).mfaPending = token.mfaPending;
        (session.user as Record<string, unknown>).mfaVerified = token.mfaVerified;
        (session.user as Record<string, unknown>).mfaEnabled = token.mfaEnabled;
      }

      // Single-session enforcement
      if (token.id && token.sessionToken) {
        const dbToken = getSessionToken(Number(token.id));
        if (dbToken && dbToken !== token.sessionToken) {
          return { ...session, user: undefined, expires: new Date(0).toISOString() };
        }
      }

      // Admin session timeout: 60 min inactivity (SOC 2 A3)
      if (token.role === "admin" && token.lastActivity) {
        const elapsed = Date.now() - (token.lastActivity as number);
        if (elapsed > 60 * 60 * 1000) {
          logSecurityEvent({
            user_id: Number(token.id),
            username: token.username as string,
            action: "SESSION_EXPIRED",
            details: JSON.stringify({ role: "admin", elapsed_min: Math.round(elapsed / 60000) }),
          });
          return { ...session, user: undefined, expires: new Date(0).toISOString() };
        }
      }

      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "vancomyzer-dev-secret-change-in-production",
};
