"use client";

import { SessionProvider, useSession, signOut } from "next-auth/react";
import React, { createContext, useContext } from "react";
import { normalizeTier, type TierId } from "@/lib/tiers";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  institution: string | null;
  credentials: string;
  first_login_acknowledged: number;
  subscriptionTier: TierId;
  institutionalAccountId: number | null;
  institutionalRole: "user" | "admin";
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

function AuthInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const user: AuthUser | null = session?.user ? {
    id: (session.user as Record<string, unknown>).id as string ?? "",
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    username: (session.user as Record<string, unknown>).username as string ?? "",
    role: (session.user as Record<string, unknown>).role as string ?? "pharmacist",
    institution: (session.user as Record<string, unknown>).institution as string ?? null,
    credentials: (session.user as Record<string, unknown>).credentials as string ?? "",
    first_login_acknowledged: (session.user as Record<string, unknown>).first_login_acknowledged as number ?? 0,
    subscriptionTier: normalizeTier((session.user as Record<string, unknown>).subscriptionTier),
    institutionalAccountId: (session.user as Record<string, unknown>).institutionalAccountId as number ?? null,
    institutionalRole: ((session.user as Record<string, unknown>).institutionalRole as string ?? "user") as "user" | "admin",
  } : null;

  const logout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <AuthContext.Provider value={{ user, loading: status === "loading", logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthInner>{children}</AuthInner>
    </SessionProvider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
