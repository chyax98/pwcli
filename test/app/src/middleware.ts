import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "pwcli_session";

const PROTECTED_PATHS = [
  "/dashboard",
  "/forms",
  "/interactions",
  "/modals",
  "/dynamic",
  "/tabs",
  "/network",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE);
  if (!session?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/forms/:path*",
    "/interactions/:path*",
    "/modals/:path*",
    "/dynamic/:path*",
    "/tabs/:path*",
    "/network/:path*",
  ],
};
