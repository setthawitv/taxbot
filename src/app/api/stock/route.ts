import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// Authorize the client-supplied id against the caller's session (own/admin).
async function resolveUserId(userId: string | null | undefined) {
  return authorizeUserId(userId);
}

// GET /api/stock?userId=xxx&productId=xxx  — movement history
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("userId") ?? searchParams.get("lineUserId");
  const productId  = searchParams.get("productId");

  if (!lineUserId) return NextResponse.json({ error: "missing userId" }, { status: 400 });
  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ movements: [] });

  let query = supabaseAdmin
    .from("stock_movements")
    .select("*, products(name, sku, unit)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (productId) query = query.eq("product_id", productId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ movements: data ?? [] });
}

// POST /api/stock — manual stock adjustment or save platform mappings + deduct
export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Save platform mappings + deduct stock from platform import ──
  if (body.action === "map_and_deduct") {
    const { mappings, batchId } = body;
    const lineUserId = body.userId ?? body.lineUserId;
    // mappings = [{ platform, platformName, productId, qty }]

    const userId = await resolveUserId(lineUserId);
    if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

    let deducted = 0;
    for (const m of mappings) {
      // composite key = platformName | variant  (or just platformName if no variant)
      const compositeKey = m.variant?.trim()
        ? `${m.platformName.trim()} | ${m.variant.trim()}`
        : m.platformName.trim();

      // Save mapping for future auto-match
      await supabaseAdmin.from("product_platform_names").upsert({
        user_id:       userId,
        product_id:    m.productId,
        platform:      m.platform,
        platform_name: compositeKey,
      }, { onConflict: "user_id,platform,platform_name" });

      // Get current stock
      const { data: prod } = await supabaseAdmin
        .from("products").select("stock_qty").eq("id", m.productId).single();
      const currentQty = prod?.stock_qty ?? 0;
      const newQty     = Math.max(0, currentQty - m.qty);

      // Deduct stock
      await supabaseAdmin.from("products")
        .update({ stock_qty: newQty }).eq("id", m.productId);

      await supabaseAdmin.from("stock_movements").insert({
        user_id:    userId,
        product_id: m.productId,
        type:       "out",
        qty:        -m.qty,
        stock_after: newQty,
        ref_type:   "import_excel",
        ref_id:     batchId ?? null,
        note:       `ยอดขาย ${m.platform} (${m.platformName})`,
      });
      deducted++;
    }
    return NextResponse.json({ ok: true, deducted });
  }

  // ── Manual stock adjustment ──
  const { productId, type, qty, note } = body;
  const lineUserId = body.userId ?? body.lineUserId;
  if (!lineUserId || !productId || !qty)
    return NextResponse.json({ error: "missing params" }, { status: 400 });

  const userId = await resolveUserId(lineUserId);
  if (!userId) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { data: prod } = await supabaseAdmin
    .from("products").select("stock_qty").eq("id", productId).single();
  const currentQty = prod?.stock_qty ?? 0;
  const delta = type === "out" ? -Math.abs(qty) : Math.abs(qty);
  const newQty = Math.max(0, currentQty + delta);

  await supabaseAdmin.from("products").update({ stock_qty: newQty }).eq("id", productId);
  await supabaseAdmin.from("stock_movements").insert({
    user_id: userId, product_id: productId,
    type, qty: delta, stock_after: newQty,
    ref_type: "manual", note: note ?? "",
  });

  return NextResponse.json({ ok: true, stock_qty: newQty });
}
