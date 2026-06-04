import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Composite key: "ชื่อสินค้า | ชื่อตัวเลือก" (variant part is optional)
function compositeKey(productName: string, variant: string | null): string {
  const v = (variant ?? "").trim();
  return v ? `${productName.trim()} | ${v}` : productName.trim();
}

// GET /api/stock/unmatched?lineUserId=xxx&platform=shopee&batchId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const platform   = searchParams.get("platform");
  const batchId    = searchParams.get("batchId");

  if (!lineUserId || !platform) return NextResponse.json({ unmatched: [], matched: [] });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ unmatched: [], matched: [] });

  // Get orders from this batch — include variant
  let query = supabaseAdmin
    .from("platform_orders")
    .select("product_name, variant, amount")
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (batchId) query = query.eq("import_batch_id", batchId);

  const { data: orders } = await query;
  if (!orders?.length) return NextResponse.json({ unmatched: [], matched: [] });

  // Aggregate qty per composite key (name | variant)
  const keyMap: Record<string, { qty: number; productName: string; variant: string }> = {};
  for (const o of orders) {
    const key = compositeKey(o.product_name, o.variant);
    if (!keyMap[key]) {
      keyMap[key] = { qty: 0, productName: o.product_name, variant: o.variant ?? "" };
    }
    keyMap[key].qty += 1; // each row = 1 order (qty=1 per line in Shopee)
  }

  const allKeys = Object.keys(keyMap);

  // Find existing mappings for these composite keys
  const { data: existing } = await supabaseAdmin
    .from("product_platform_names")
    .select("platform_name, product_id, products(id, name, sku, stock_qty, attr1_val, attr2_val)")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .in("platform_name", allKeys);

  const mappedKeys = new Set((existing ?? []).map((e) => e.platform_name));

  const unmatched = allKeys
    .filter((k) => !mappedKeys.has(k))
    .map((k) => ({
      key:         k,
      platformName: keyMap[k].productName,
      variant:     keyMap[k].variant,
      qty:         keyMap[k].qty,
    }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matched = (existing ?? []).map((e: any) => ({
    key:         e.platform_name,
    platformName: keyMap[e.platform_name]?.productName ?? e.platform_name,
    variant:     keyMap[e.platform_name]?.variant ?? "",
    productId:   e.product_id,
    productName: e.products?.name ?? "",
    attrVal:     [e.products?.attr1_val, e.products?.attr2_val].filter(Boolean).join(" / "),
    qty:         keyMap[e.platform_name]?.qty ?? 0,
  }));

  return NextResponse.json({ unmatched, matched, platform, batchId: batchId ?? "" });
}
