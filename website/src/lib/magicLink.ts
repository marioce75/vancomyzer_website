/**
 * Magic-link tokens for passwordless sign-in.
 *
 * Stateless, signed JWTs valid for 15 minutes. The signing secret is
 * NEXTAUTH_SECRET (already required by NextAuth, no new env var needed).
 *
 * Flow:
 *   1. POST /api/auth/magic-link  { email }
 *      → issueMagicLinkToken(email) → emailed as
 *        https://app/api/auth/magic-link/callback?token=...
 *   2. User clicks link → callback validates token, redirects to
 *      /login?magic=<token>
 *   3. Login page calls signIn("magic-link", { token })
 *   4. CredentialsProvider("magic-link") in authOptions calls
 *      verifyMagicLinkToken(token) → returns user payload → session
 *
 * Token contents are minimal — only the email is encoded. The user
 * record is freshly fetched at verify time so a deactivated/locked
 * account cannot complete sign-in even if the link was issued earlier.
 */

import crypto from "crypto";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const ALGO = "sha256";

interface MagicLinkPayload {
  email: string;
  iat: number;
  exp: number;
}

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required to sign magic-link tokens.");
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

export function issueMagicLinkToken(email: string): string {
  const now = Date.now();
  const payload: MagicLinkPayload = {
    email: email.toLowerCase().trim(),
    iat: now,
    exp: now + TOKEN_TTL_MS,
  };
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto.createHmac(ALGO, getSecret()).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyMagicLinkToken(token: string): { email: string } | null {
  try {
    const [payloadB64, sigB64] = token.split(".");
    if (!payloadB64 || !sigB64) return null;

    const expectedSig = crypto.createHmac(ALGO, getSecret()).update(payloadB64).digest();
    const providedSig = base64UrlDecode(sigB64);
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as MagicLinkPayload;
    if (Date.now() > payload.exp) return null;
    if (typeof payload.email !== "string" || payload.email.length === 0) return null;

    return { email: payload.email };
  } catch {
    return null;
  }
}
