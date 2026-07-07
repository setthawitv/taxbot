import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/stock/summary?lineUserId=xxx
// Returns each product with sold qty per platform + remaining stock
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  if (!lineUserId) return NextResponse.json({ summary: [] });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ summary: [] });

  // Get all active products
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, sku, name, unit, cost_price, sell_price, stock_qty, low_stock_at, attr1_val, attr2_val")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("name");

  if (!products?.length) return NextResponse.json({ summary: [] });

  const productIds = products.map((p) => p.id);

  // Get all stock movements grouped by product + ref_note (to extract platform)
  const { data: movements } = await supabaseAdmin
    .from("stock_movements")
    .select("product_id, type, qty, ref_type, note, created_at")
    .eq("user_id", user.id)
    .in("product_id", productIds);

  // Get platform sales from product_platform_names + platform_orders
  // Count sold qty per product per platform
  const { data: mappings } = await supabaseAdmin
    .from("product_platform_names")
    .select("product_id, platform, platform_name")
    .eq("user_id", user.id)
    .in("product_id", productIds);

  // Build sold counts per product per platform from stock_movements
  type PlatformCount = Record<string, number>; // platform → qty
  const soldByProduct: Record<string, PlatformCount> = {};
  const inByProduct:   Record<string, number> = {};

  for (const m of movements ?? []) {
    if (!soldByProduct[m.product_id]) soldByProduct[m.product_id] = {};
    if (!inByProduct[m.product_id])   inByProduct[m.product_id]   = 0;

    if (m.type === "out") {
      // Extract platform from note: "ยอดขาย shopee (...)" or "ยอดขาย tiktok (...)"
      const note = (m.note ?? "").toLowerCase();
      const platform =
        note.includes("shopee")  ? "shopee"  :
        note.includes("tiktok")  ? "tiktok"  :
        note.includes("lazada")  ? "lazada"  : "manual";
      soldByProduct[m.product_id][platform] = (soldByProduct[m.product_id][platform] ?? 0) + Math.abs(m.qty);
    } else if (m.type === "in") {
      inByProduct[m.product_id] += m.qty;
    }
  }

  // Which platforms does each product have mappings for?
  const platformsByProduct: Record<string, string[]> = {};
  for (const mp of mappings ?? []) {
    if (!platformsByProduct[mp.product_id]) platformsByProduct[mp.product_id] = [];
    if (!platformsByProduct[mp.product_id].includes(mp.platform)) {
      platformsByProduct[mp.product_id].push(mp.platform);
    }
  }

  const summary = products.map((p) => {
    const sold       = soldByProduct[p.id] ?? {};
    const totalSold  = Object.values(sold).reduce((s, v) => s + v, 0);
    const platforms  = platformsByProduct[p.id] ?? [];

    return {
      id:          p.id,
      sku:         p.sku,
      name:        p.name,
      unit:        p.unit,
      attr1_val:   p.attr1_val,
      attr2_val:   p.attr2_val,
      cost_price:  p.cost_price,
      sell_price:  p.sell_price,
      stock_in:    inByProduct[p.id] ?? 0,
      stock_qty:   p.stock_qty,          // current remaining
      total_sold:  totalSold,
      sold_by_platform: sold,            // { shopee: 20, tiktok: 25 }
      platforms,                         // platforms with mappings
      low_stock_at: p.low_stock_at,
      is_low:      p.stock_qty <= p.low_stock_at,
    };
  });

  return NextResponse.json({ summary });
}
