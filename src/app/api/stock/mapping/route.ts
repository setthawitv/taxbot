import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function resolveUserId(lineUserId: string) {
  const { data } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  return data?.id ?? null;
}

// POST /api/stock/mapping — add platform name mapping
export async function POST(req: NextRequest) {
  const { lineUserId, productId, platform, platformName } = await req.json();
  if (!lineUserId || !productId || !platform || !platformName)
    return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("product_platform_names")
    .upsert({
      user_id:       userId,
      product_id:    productId,
      platform,
      platform_name: platformName,
    }, { onConflict: "user_id,platform,platform_name" })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// DELETE /api/stock/mapping — remove a mapping
export async function DELETE(req: NextRequest) {
  const { id, lineUserId } = await req.json();
  if (!id || !lineUserId) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await supabaseAdmin.from("product_platform_names")
    .delete().eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
