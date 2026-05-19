import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/intro",             // Feature intro slides (first-time users land here)
  "/onboarding",        // 3-step onboarding wizard
  "/connect-google",    // Google OAuth flow opened in external browser
  "/staff",             // Staff expense entry (invite-code based, no auth)
  "/api/auth",
  "/api/webhook",
  "/api/user",
  "/api/staff",
  "/api/setup-richmenu",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const onboarded = request.cookies.get("taxbot_onboarded")?.value;
  if (!onboarded) {
    // Send to onboarding — it auto-skips to dashboard if user is already registered
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
