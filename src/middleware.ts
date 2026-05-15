import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/onboarding",
  "/connect-google",     // Google OAuth flow opened in external browser
  "/api/auth",
  "/api/webhook",
  "/api/user",
  "/api/setup-richmenu",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const onboarded = request.cookies.get("taxbot_onboarded")?.value;
  if (!onboarded) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
