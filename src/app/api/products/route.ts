import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

async function resolveUserId(lineUserId: string) {
  const { data } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  return data?.id ?? null;
}

// GET /api/products?lineUserId=xxx&search=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const search     = searchParams.get("search") ?? "";

  if (!lineUserId) return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

// POST /api/products — create single product
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lineUserId, ...fields } = body;
  if (!lineUserId) return NextResponse.json({ error: "missing lineUserId" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert({ user_id: userId, ...fields })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  const { lineUserId, id, ...fields } = await req.json();
  if (!lineUserId || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("products")
    .update(fields)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/products
export async function DELETE(req: NextRequest) {
  const { lineUserId, id } = await req.json();
  if (!lineUserId || !id) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  await supabaseAdmin.from("products").update({ is_active: false })
    .eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
