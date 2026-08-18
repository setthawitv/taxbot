import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  verifyState,
  exchangeCodeForToken,
  getAuthorizedShops,
  type TikTokShop,
} from "@/lib/tiktok";

// GET /api/tiktok/callback?code=...&state=...
// TikTok redirects the seller here after they authorize. We validate the signed
// state, exchange the auth code for tokens, fetch the authorized shop, and store
// everything against the user the state was issued for.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const back = (status: string) =>
    NextResponse.redirect(new URL(`/settings?tiktok=${status}`, req.url));

  const userId = verifyState(state);
  if (!code || !userId) return back("error");

  try {
    const token = await exchangeCodeForToken(code);

    // Fetch the authorized shop (id + cipher are needed for later business calls).
    let shop: TikTokShop | undefined;
    try {
      const shops = await getAuthorizedShops(token.access_token);
      shop = shops[0];
    } catch {
      // Non-fatal: keep the token even if the shop lookup momentarily fails.
    }

    // One active TikTok connection per user (MVP): replace any existing row.
    await supabaseAdmin
      .from("platform_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("platform", "tiktok");

    const { error } = await supabaseAdmin.from("platform_tokens").insert({
      user_id: userId,
      platform: "tiktok",
      shop_id: shop?.id ?? null,
      shop_name: shop?.name ?? token.seller_name ?? null,
      shop_cipher: shop?.cipher ?? null,
      region: shop?.region ?? token.seller_base_region ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      access_expires_at: new Date(token.access_token_expire_in * 1000).toISOString(),
      refresh_expires_at: new Date(token.refresh_token_expire_in * 1000).toISOString(),
      scope: (token.granted_scopes ?? []).join(","),
      updated_at: new Date().toISOString(),
    });

    if (error) return back("error");
    return back("connected");
  } catch {
    return back("error");
  }
}
