import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/platforms/status?userId=xxx
// A platform counts as "connected" if the account has an OAuth token for it
// OR has at least one imported order from it.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  const empty = { shopee: false, tiktok: false, lazada: false };
  if (!userId) return NextResponse.json(empty);

  const [tokens, orders] = await Promise.all([
    supabaseAdmin.from("platform_tokens").select("platform").eq("user_id", userId),
    supabaseAdmin.from("platform_orders").select("platform").eq("user_id", userId),
  ]);

  const tokenSet = new Set<string>();
  for (const row of tokens.data ?? []) if (row.platform) tokenSet.add(row.platform);
  const orderSet = new Set<string>();
  for (const row of orders.data ?? []) if (row.platform) orderSet.add(row.platform);

  // A platform is "connected" if it has a real OAuth token OR imported orders.
  // "demo" (simulated) = shown as connected but not backed by a live API
  // integration. Only TikTok Shop has a real integration (Vendee is a published
  // TikTok Shop Partner); Shopee/Lazada data is sample data until their API is
  // integrated, so they count as demo whenever they lack a real token.
  const connected = (p: string) => tokenSet.has(p) || orderSet.has(p);
  const demo = (p: string) => connected(p) && !tokenSet.has(p) && p !== "tiktok";

  return NextResponse.json({
    shopee: connected("shopee"),
    tiktok: connected("tiktok"),
    lazada: connected("lazada"),
    demo: {
      shopee: demo("shopee"),
      tiktok: demo("tiktok"),
      lazada: demo("lazada"),
    },
  });
}
