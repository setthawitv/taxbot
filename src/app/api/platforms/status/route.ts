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
  // It is "demo" (simulated) when it only has sample orders but no live token.
  const connected = (p: string) => tokenSet.has(p) || orderSet.has(p);
  const demo = (p: string) => !tokenSet.has(p) && orderSet.has(p);

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
