import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { findUserByLogin, updateLastLogin } from "@/lib/db";

const handler = NextAuth({
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
        if (!user) return null;

        // Check status
        if (user.status === "pending") {
          throw new Error("PENDING");
        }
        if (user.status === "disabled") {
          throw new Error("DISABLED");
        }
        if (user.status !== "active") return null;

        // Verify password
        const valid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!valid) return null;

        // Update last login
        updateLastLogin(user.id);

        return {
          id: String(user.id),
          name: user.full_name,
          email: user.email,
          username: user.username,
          role: user.role,
          first_login_acknowledged: user.first_login_acknowledged,
          institution: user.institution,
          credentials: user.credentials,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 28800, // 8 hours
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>;
        token.id = u.id;
        token.username = u.username;
        token.role = u.role;
        token.first_login_acknowledged = u.first_login_acknowledged;
        token.institution = u.institution;
        token.credentials = u.credentials;
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
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET ?? "vancomyzer-dev-secret-change-in-production",
});

export { handler as GET, handler as POST };
