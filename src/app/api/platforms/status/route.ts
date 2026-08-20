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

  const connected = new Set<string>();
  for (const row of tokens.data ?? []) if (row.platform) connected.add(row.platform);
  for (const row of orders.data ?? []) if (row.platform) connected.add(row.platform);

  return NextResponse.json({
    shopee: connected.has("shopee"),
    tiktok: connected.has("tiktok"),
    lazada: connected.has("lazada"),
  });
}
