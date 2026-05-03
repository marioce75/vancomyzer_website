import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

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

  // Protected pages — require session
  const protectedPages = ["/", "/calculator", "/admin", "/research", "/mfa-verify"];
  const needsPageAuth = protectedPages.some(p => pathname === p || pathname.startsWith(p + "/"));

  // Protected APIs — require session.
  // Note: /api/billing/webhook is INTENTIONALLY excluded — Stripe calls
  // it without a user session, signature verification gates it instead.
  const protectedAPIs = [
    "/api/calculate",
    "/api/audit",
    "/api/admin",
    "/api/research",
    "/api/auth/mfa",
    "/api/billing/checkout",
    "/api/billing/portal",
    "/api/history",
    "/api/team",
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

  // Pass user info in headers for downstream API routes
  if (token) {
    const response = NextResponse.next();
    response.headers.set("x-user-email", (token.email as string) ?? "");
    response.headers.set("x-user-name", (token.name as string) ?? "");
    response.headers.set("x-user-id", String(token.id ?? ""));
    response.headers.set("x-user-username", (token.username as string) ?? "");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
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
  ],
};
