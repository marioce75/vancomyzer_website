/**
 * Per-session research acknowledgement for the pediatric preview.
 *
 * A calculation is refused on the server until the signed-in administrator
 * has acknowledged the current research statement in the CURRENT login
 * session. The acknowledgement is a stateless, HMAC-signed token kept in an
 * httpOnly cookie scoped to /api/admin/pediatric and bound to:
 *   - the user id,
 *   - a hash of the login session token (regenerated at every sign-in, cleared
 *     on revocation, so the acknowledgement dies with the session),
 *   - the statement version (a changed statement must be re-acknowledged),
 *   - an absolute expiry (ACK_TTL_MS) as a backstop.
 * Nothing is persisted server-side and no schema or credential changes.
 */
import crypto from "node:crypto";
import { PEDIATRIC_ACK_STATEMENT_VERSION } from "./colin2019/manifest";

export const ACK_COOKIE_NAME = "pediatric_research_ack";
export const ACK_COOKIE_PATH = "/api/admin/pediatric";
export const ACK_TTL_MS = 12 * 60 * 60 * 1000;

interface AckPayload {
  uid: number;
  sth: string; // sha256(session token), hex
  v: string; // statement version
  iat: number;
  exp: number;
}

export type AckVerdict = { ok: true; issuedAt: number; expiresAt: number } | { ok: false; reason: "missing" | "malformed" | "bad_signature" | "expired" | "wrong_user" | "wrong_session" | "stale_statement" };

const b64u = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4), "base64");
const hashSession = (sessionToken: string) => crypto.createHash("sha256").update(sessionToken).digest("hex");
const sign = (payloadB64: string, secret: string) => crypto.createHmac("sha256", secret).update(`pediatric-ack.${payloadB64}`).digest();

export function issueAcknowledgementToken(args: { userId: number; sessionToken: string; secret: string; now?: number }): { token: string; expiresAt: number } {
  const now = args.now ?? Date.now();
  const payload: AckPayload = { uid: args.userId, sth: hashSession(args.sessionToken), v: PEDIATRIC_ACK_STATEMENT_VERSION, iat: now, exp: now + ACK_TTL_MS };
  const p = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  return { token: `${p}.${b64u(sign(p, args.secret))}`, expiresAt: payload.exp };
}

export function verifyAcknowledgementToken(token: string | undefined | null, args: { userId: number; sessionToken: string | null; secret: string; now?: number }): AckVerdict {
  if (!token) return { ok: false, reason: "missing" };
  const now = args.now ?? Date.now();
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const expected = sign(parts[0], args.secret);
  let provided: Buffer;
  try { provided = unb64u(parts[1]); } catch { return { ok: false, reason: "malformed" }; }
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) return { ok: false, reason: "bad_signature" };
  let payload: AckPayload;
  try { payload = JSON.parse(unb64u(parts[0]).toString("utf8")) as AckPayload; } catch { return { ok: false, reason: "malformed" }; }
  if (typeof payload.uid !== "number" || typeof payload.sth !== "string" || typeof payload.v !== "string" || typeof payload.iat !== "number" || typeof payload.exp !== "number") return { ok: false, reason: "malformed" };
  if (!Number.isFinite(payload.exp) || payload.exp <= now || payload.iat > now || payload.exp - payload.iat > ACK_TTL_MS) return { ok: false, reason: "expired" };
  if (payload.uid !== args.userId) return { ok: false, reason: "wrong_user" };
  if (!args.sessionToken || payload.sth !== hashSession(args.sessionToken)) return { ok: false, reason: "wrong_session" };
  if (payload.v !== PEDIATRIC_ACK_STATEMENT_VERSION) return { ok: false, reason: "stale_statement" };
  return { ok: true, issuedAt: payload.iat, expiresAt: payload.exp };
}

/** Cookie attributes: httpOnly, same-site strict, path-scoped to the pediatric API, secure outside development. */
export function ackCookieOptions(expiresAt: number) {
  return { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: ACK_COOKIE_PATH, expires: new Date(expiresAt) };
}
