import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET ?? "vancomyzer-dev-secret-change-in-production",
  });

  // Already logged in → redirect away from login/register
  if (token && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/calculator", request.url));
  }

  // Protected pages — require session
  const protectedPages = ["/", "/calculator", "/admin", "/research"];
  const needsPageAuth = protectedPages.some(p => pathname === p || pathname.startsWith(p + "/"));

  // Protected APIs — require session
  const protectedAPIs = ["/api/calculate", "/api/audit", "/api/admin", "/api/research"];
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
    "/api/calculate/:path*",
    "/api/audit/:path*",
    "/api/admin/:path*",
    "/research/:path*",
    "/api/research/:path*",
  ],
};
