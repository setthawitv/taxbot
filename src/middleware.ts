import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/intro",             // Feature intro slides (first-time users land here)
  "/onboarding",        // 3-step onboarding wizard
  "/connect-google",    // Google OAuth flow opened in external browser
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
    // First-time users see feature intro slides before onboarding
    return NextResponse.redirect(new URL("/intro", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
