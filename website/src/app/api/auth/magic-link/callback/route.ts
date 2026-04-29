/**
 * GET /api/auth/magic-link/callback?token=...
 *
 * Validates the signed magic-link token and redirects the user to the
 * login page with the token attached so the client can complete sign-in
 * via the "magic-link" CredentialsProvider.
 *
 * The actual session establishment happens client-side by calling
 * signIn("magic-link", { token }) — that path is the only place a
 * session cookie can be issued through NextAuth on the JWT strategy.
 */

import { NextResponse } from "next/server";
import { verifyMagicLinkToken } from "@/lib/magicLink";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?magic_error=missing", url.origin));
  }

  const verified = verifyMagicLinkToken(token);
  if (!verified) {
    return NextResponse.redirect(new URL("/login?magic_error=invalid", url.origin));
  }

  // Token is valid. Hand off to client to complete sign-in via
  // signIn("magic-link", { token }). The token is short-lived and bound
  // to email by HMAC, so attaching it to the redirect URL is safe.
  return NextResponse.redirect(
    new URL(`/login?magic=${encodeURIComponent(token)}`, url.origin),
  );
}
