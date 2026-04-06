/**
 * Shared admin gate for research API routes.
 * Returns the admin session or null if not authorized.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function requireResearchAdmin(): Promise<{
  id: string;
  username: string;
  email: string;
  role: string;
} | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as Record<string, unknown>;
  if (user.role !== "admin") return null;
  return {
    id: String(user.id ?? ""),
    username: String(user.username ?? ""),
    email: String(user.email ?? ""),
    role: String(user.role ?? ""),
  };
}
