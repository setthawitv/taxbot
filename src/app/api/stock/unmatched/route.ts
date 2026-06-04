import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/stock/unmatched?lineUserId=xxx&platform=shopee&batchId=xxx
// Returns platform product names that have no mapping yet
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const platform   = searchParams.get("platform");
  const batchId    = searchParams.get("batchId");

  if (!lineUserId || !platform) return NextResponse.json({ unmatched: [] });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ unmatched: [] });

  // Get distinct product names + qty from this batch
  let query = supabaseAdmin
    .from("platform_orders")
    .select("product_name, variant")
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (batchId) query = query.eq("import_batch_id", batchId);

  const { data: orders } = await query;
  if (!orders?.length) return NextResponse.json({ unmatched: [] });

  // Aggregate qty per product name
  const qtyMap: Record<string, number> = {};
  for (const o of orders) {
    const key = o.product_name;
    qtyMap[key] = (qtyMap[key] ?? 0) + 1; // each order = 1 unit (adjust if qty column exists)
  }

  // Find which names already have mappings
  const names = Object.keys(qtyMap);
  const { data: existing } = await supabaseAdmin
    .from("product_platform_names")
    .select("platform_name, product_id, products(id, name, sku, stock_qty)")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .in("platform_name", names);

  const mappedNames = new Set((existing ?? []).map((e) => e.platform_name));

  const unmatched = names
    .filter((n) => !mappedNames.has(n))
    .map((n) => ({ platformName: n, qty: qtyMap[n] }));

  const matched = (existing ?? []).map((e) => ({
    platformName: e.platform_name,
    productId:    e.product_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    productName:  (e.products as any)?.name ?? "",
    qty:          qtyMap[e.platform_name] ?? 0,
  }));

  return NextResponse.json({ unmatched, matched, platform, batchId });
}
