import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { findUserById, getSessionToken } from "@/lib/db";
import { readStudyDemoConfig, studyDemoOwnerAllowed } from "./access";

/**
 * True only for the configured owner's verified admin session. Checked on the
 * server by the page and by every endpoint before anything is read or served.
 * Fails closed on any error or missing configuration.
 */
export async function isStudyDemoOwner(): Promise<boolean> {
  try {
    const config = readStudyDemoConfig(process.env);
    if (!config) return false;
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) return false;
    const token = await getToken({ req: new NextRequest("http://localhost", { headers: headers() }), secret });
    if (!token || typeof token.id !== "string" || !/^[1-9]\d*$/.test(token.id)) return false;
    const id = Number(token.id);
    if (!Number.isSafeInteger(id) || id !== config.ownerUserId) return false;
    return studyDemoOwnerAllowed(config, token as Record<string, unknown>, findUserById(id), getSessionToken(id));
  } catch {
    return false;
  }
}
