import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/tiktok/status?userId=xxx
// Reports whether the account has a stored TikTok Shop connection.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ connected: false });

  const { data } = await supabaseAdmin
    .from("platform_tokens")
    .select("shop_name, shop_id, connected_at")
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .maybeSingle();

  return NextResponse.json({
    connected: !!data,
    shop_name: data?.shop_name ?? null,
  });
}
