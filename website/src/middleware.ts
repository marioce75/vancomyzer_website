import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { OPEN_ACCESS } from "@/lib/openAccess";

/**
 * Identity headers forwarded to route handlers. Incoming copies are always
 * stripped before forwarding, so a client cannot forge them. Route handlers
 * should still derive identity from getServerSession() — these headers are
 * only trustworthy when this middleware actually ran for the request.
 */
const IDENTITY_HEADER_PREFIX = "x-user-";

/**
 * Header values must be byte strings. A free-text value such as a display
 * name with Vietnamese or CJK characters makes Headers.set throw, which would
 * fail the whole request; omit that one header instead.
 */
function setIdentityHeader(headers: Headers, name: string, value: string): void {
  try {
    headers.set(name, value);
  } catch {
    /* not representable as a header value — leave it unset */
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? "vancomyzer-dev-secret-change-in-production",
  });

  // Already logged in → redirect away from login/register
  // Exception: allow /login?magic=... through so the magic-link sign-in
  // can replace the existing session (handles the case where a user
  // clicks a link from a different account or a re-issued link).
  const isMagicLinkAttempt = pathname === "/login" && request.nextUrl.searchParams.has("magic");
  if (token && !isMagicLinkAttempt && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/calculator", request.url));
  }

  // Protected pages — require session.
  // "/" is the public landing page and is never protected (it is also no
  // longer in the matcher). "/calculator" requires a session only when open
  // access is off (NEXT_PUBLIC_OPEN_ACCESS=false — see lib/openAccess.ts).
  const protectedPages = [
    ...(OPEN_ACCESS ? [] : ["/calculator"]),
    "/admin",
    "/research",
    "/mfa-verify",
  ];
  const needsPageAuth = protectedPages.some(p => pathname === p || pathname.startsWith(p + "/"));

  // Protected APIs — require session.
  // Note: /api/billing/webhook is INTENTIONALLY excluded — Stripe calls
  // it without a user session, signature verification gates it instead.
  // /api/calculate follows the same open-access switch as /calculator;
  // anonymous calculate traffic is rate limited inside the route handler.
  const protectedAPIs = [
    ...(OPEN_ACCESS ? [] : ["/api/calculate"]),
    "/api/audit",
    "/api/admin",
    "/api/research",
    "/api/auth/mfa",
    "/api/billing/checkout",
    "/api/billing/portal",
    "/api/history",
    "/api/team",
    "/api/bug-report",
  ];
  const needsAPIAuth = protectedAPIs.some(p => pathname.startsWith(p));

  if (needsPageAuth && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (needsAPIAuth && !token) {
    return NextResponse.json({ error: "Unauthorized — please log in." }, { status: 401 });
  }

  // Admin + Research pages — require admin role (silently redirect non-admins)
  if ((pathname.startsWith("/admin") || pathname.startsWith("/research")) && token?.role !== "admin") {
    return NextResponse.redirect(new URL("/calculator", request.url));
  }

  // MFA gate (SOC 2 A1): admin users with MFA enabled AND pending must verify
  // Only triggers when mfaPending is explicitly true (not undefined/null/false)
  // Admins who haven't set up MFA yet (mfaPending=false) go straight through
  if (token?.mfaPending === true && token?.mfaVerified !== true) {
    const mfaAllowed = pathname === "/mfa-verify" || pathname.startsWith("/api/auth/") || pathname === "/calculator" || pathname.startsWith("/api/calculate");
    if (!mfaAllowed && (pathname.startsWith("/admin") || pathname.startsWith("/research"))) {
      return NextResponse.redirect(new URL("/mfa-verify", request.url));
    }
  }

  // Forward verified identity to route handlers as REQUEST headers.
  //
  // SECURITY: headers set on `NextResponse.next().headers` are RESPONSE
  // headers — they go to the browser and never reach route handlers — while
  // any x-user-* header the client sends DOES reach them. So: copy the
  // incoming request headers, strip every client-supplied x-user-*, add the
  // verified values only when a valid session token exists, and pass the
  // sanitized set downstream with NextResponse.next({ request: { headers } }).
  // Next 14.2 applies that via x-middleware-override-headers, which replaces
  // the downstream request headers wholesale (so deletions here take effect).
  // Identity is deliberately NOT echoed in response headers.
  const requestHeaders = new Headers(request.headers);
  // Collect names first — deleting while iterating a Headers object skips entries.
  for (const name of Array.from(requestHeaders.keys())) {
    if (name.startsWith(IDENTITY_HEADER_PREFIX)) requestHeaders.delete(name);
  }
  if (token) {
    setIdentityHeader(requestHeaders, "x-user-email", (token.email as string) ?? "");
    setIdentityHeader(requestHeaders, "x-user-name", (token.name as string) ?? "");
    setIdentityHeader(requestHeaders, "x-user-id", String(token.id ?? ""));
    setIdentityHeader(requestHeaders, "x-user-username", (token.username as string) ?? "");
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // "/" is intentionally not matched: it is the public landing page and
  // needs no session check or identity forwarding.
  matcher: [
    "/calculator/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/mfa-verify",
    "/api/calculate/:path*",
    "/api/audit/:path*",
    "/api/admin/:path*",
    "/api/auth/mfa/:path*",
    "/research/:path*",
    "/api/research/:path*",
    "/api/billing/checkout",
    "/api/billing/portal",
    "/api/history",
    "/api/team/:path*",
    "/api/bug-report",
  ],
};
