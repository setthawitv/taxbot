import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// Authorize the client-supplied id against the caller's session (own/admin).
async function resolveUserId(userId: string | null | undefined) {
  return authorizeUserId(userId);
}

// GET /api/products?userId=xxx&search=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("userId") ?? searchParams.get("lineUserId");
  const search     = searchParams.get("search") ?? "";

  if (!lineUserId) return NextResponse.json({ error: "missing userId" }, { status: 400 });
  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ products: [] });

  let query = supabaseAdmin
    .from("products")
    .select("*, product_platform_names(id, platform, platform_name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("name");

  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// POST /api/products — create single product
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId: bodyUserId, lineUserId: bodyLineUserId, ...fields } = body;
  const lineUserId = bodyUserId ?? bodyLineUserId;
  if (!lineUserId) return NextResponse.json({ error: "missing userId" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({ user_id: userId, ...fields })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });

  // Record opening stock movement if stock_qty > 0
  if ((fields.stock_qty ?? 0) > 0) {
    await supabaseAdmin.from("stock_movements").insert({
      user_id:     userId,
      product_id:  data.id,
      type:        "in",
      qty:         fields.stock_qty,
      stock_after: fields.stock_qty,
      ref_type:    "manual",
      note:        "ยอดยกมา",
    });
  }

  return NextResponse.json({ product: data });
}

// PATCH /api/products — update product
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, ...fields } = body;
  const lineUserId = body.userId ?? body.lineUserId;
  if (!lineUserId || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("products")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/products
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;
  const lineUserId = body.userId ?? body.lineUserId;
  if (!lineUserId || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await supabaseAdmin.from("products").update({ is_active: false })
    .eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
