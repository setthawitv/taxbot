import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/",                  // Public marketing landing page (root)
  "/landing",           // Legacy URL — keep for backward compatibility
  "/privacy",           // Public legal pages
  "/terms",
  "/features",          // Feature detail pages
  "/intro",             // Feature intro slides (first-time users land here)
  "/onboarding",        // 3-step onboarding wizard
  "/connect-google",    // Google OAuth flow opened in external browser
  "/demo-login",        // Reviewer (Shopee) username/password login
  "/staff",             // Staff expense entry (invite-code based, no auth)
  "/admin/join",        // Admin invite acceptance (requires Google sign-in, not LINE)
  "/api/auth",
  "/api/webhook",
  "/api/user",
  "/api/leads",           // Public lead-capture form on the tax calculator
  "/api/staff",
  "/api/admin/join",    // Admin join endpoint (called before full auth)
  "/api/setup-richmenu",
  "/api/payment",         // Payment API + webhook
  "/payment",             // Payment done redirect page
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );
  if (isPublic) return NextResponse.next();

  // Accept the new `vendee_` cookie or the legacy `taxbot_` one (pre-rebrand users)
  const onboarded =
    request.cookies.get("vendee_onboarded")?.value ??
    request.cookies.get("taxbot_onboarded")?.value;
  if (!onboarded) {
    // Send to onboarding — it auto-skips to dashboard if user is already registered
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
