import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

async function resolveUserId(userId: string | null | undefined) {
  return authorizeUserId(userId);
}

// POST /api/stock/mapping — add platform name mapping
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { productId, platform, platformName } = body;
  const lineUserId = body.userId ?? body.lineUserId;
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

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// DELETE /api/stock/mapping — remove a mapping
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;
  const lineUserId = body.userId ?? body.lineUserId;
  if (!id || !lineUserId) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await supabaseAdmin.from("product_platform_names")
    .delete().eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
