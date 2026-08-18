import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import {
  assertTikTokConfigured,
  buildAuthorizeUrl,
  signState,
  TIKTOK_SERVICE_ID,
} from "@/lib/tiktok";

// GET /api/tiktok/connect
// Starts the TikTok Shop OAuth flow: signs the caller's user id into `state`
// (so the callback can bind the shop to them) and redirects to TikTok's
// seller-authorization page.
export async function GET(req: NextRequest) {
  const userId = await authorizeUserId();
  if (!userId) {
    // Not logged in → send to onboarding.
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  try {
    assertTikTokConfigured();
    if (!TIKTOK_SERVICE_ID) throw new Error("TIKTOK_SERVICE_ID not set");
  } catch {
    return NextResponse.redirect(new URL("/settings?tiktok=misconfigured", req.url));
  }

  return NextResponse.redirect(buildAuthorizeUrl(signState(userId)));
}
