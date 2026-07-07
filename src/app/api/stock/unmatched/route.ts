import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// Composite key: "ชื่อสินค้า | ชื่อตัวเลือก" (variant part is optional)
function compositeKey(productName: string, variant: string | null): string {
  const v = (variant ?? "").trim();
  return v ? `${productName.trim()} | ${v}` : productName.trim();
}

// GET /api/stock/unmatched?lineUserId=xxx&platform=shopee&batchId=xxx
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  const platform   = searchParams.get("platform");
  const batchId    = searchParams.get("batchId");

  if (!lineUserId || !platform) return NextResponse.json({ unmatched: [], matched: [] });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ unmatched: [], matched: [] });

  // Get orders from this batch — include variant + seller_sku
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabaseAdmin
    .from("platform_orders")
    .select("product_name, variant, seller_sku, amount")
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (batchId) query = query.eq("import_batch_id", batchId);

  const { data: orders } = await query;
  if (!orders?.length) return NextResponse.json({ unmatched: [], matched: [] });

  // Aggregate per composite key, also track seller_sku
  type KeyInfo = { qty: number; productName: string; variant: string; sellerSku: string };
  const keyMap: Record<string, KeyInfo> = {};
  for (const o of orders) {
    const key = compositeKey(o.product_name, o.variant);
    if (!keyMap[key]) {
      keyMap[key] = { qty: 0, productName: o.product_name, variant: o.variant ?? "", sellerSku: o.seller_sku ?? "" };
    }
    keyMap[key].qty += 1;
  }

  const allKeys = Object.keys(keyMap);

  // 1. Try SKU-based auto-match (TikTok Seller SKU → products.sku)
  const skuAutoMatched: Record<string, string> = {}; // key → productId
  const skusToMatch = [...new Set(Object.values(keyMap).map((v) => v.sellerSku).filter(Boolean))];
  if (skusToMatch.length > 0) {
    const { data: skuProducts } = await supabaseAdmin
      .from("products")
      .select("id, sku, name")
      .eq("user_id", user.id)
      .in("sku", skusToMatch);

    for (const key of allKeys) {
      const sku = keyMap[key].sellerSku;
      if (!sku) continue;
      const match = (skuProducts ?? []).find((p) => p.sku === sku);
      if (match) skuAutoMatched[key] = match.id;
    }
  }

  // 2. Check existing name-based mappings
  const { data: existing } = await supabaseAdmin
    .from("product_platform_names")
    .select("platform_name, product_id, products(id, name, sku, stock_qty, attr1_val, attr2_val)")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .in("platform_name", allKeys);

  const mappedByName = new Set((existing ?? []).map((e) => e.platform_name));

  // Build results
  const unmatched: object[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matched: any[] = [];

  for (const key of allKeys) {
    const info = keyMap[key];

    if (skuAutoMatched[key]) {
      // Auto-matched via SKU
      const { data: prod } = await supabaseAdmin.from("products").select("name, attr1_val, attr2_val")
        .eq("id", skuAutoMatched[key]).single();
      matched.push({
        key, platformName: info.productName, variant: info.variant,
        productId: skuAutoMatched[key],
        productName: prod?.name ?? "",
        attrVal: [prod?.attr1_val, prod?.attr2_val].filter(Boolean).join(" / "),
        qty: info.qty, matchMethod: "sku",
      });
    } else if (mappedByName.has(key)) {
      // Matched via saved name mapping
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = (existing ?? []).find((x: any) => x.platform_name === key)!;
      matched.push({
        key, platformName: info.productName, variant: info.variant,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        productId: e.product_id, productName: (e.products as any)?.name ?? "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attrVal: [(e.products as any)?.attr1_val, (e.products as any)?.attr2_val].filter(Boolean).join(" / "),
        qty: info.qty, matchMethod: "name",
      });
    } else {
      unmatched.push({
        key, platformName: info.productName, variant: info.variant,
        sellerSku: info.sellerSku, qty: info.qty,
      });
    }
  }

  return NextResponse.json({ unmatched, matched, platform, batchId: batchId ?? "" });
}
