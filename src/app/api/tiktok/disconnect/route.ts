import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/tiktok/disconnect?userId=xxx
// Removes the stored TikTok Shop token for the account (seller-initiated revoke).
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { error } = await supabaseAdmin
    .from("platform_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("platform", "tiktok");

  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
