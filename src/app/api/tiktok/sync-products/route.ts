import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureShopInfo } from "@/lib/tiktok-token";
import { tiktokRequest } from "@/lib/tiktok";

// GET/POST /api/tiktok/sync-products?userId=xxx&debug=1
// Phase 1b: import TikTok products/SKUs into Vendee `products` (one row per SKU),
// set real current stock, and create tiktok platform mappings.
// Idempotent: matches existing rows by (user_id, sku); updates stock/price,
// inserts only new SKUs — preserves user-edited cost_price/name/low_stock.
// debug=1 → dry run, returns TikTok field names only (no DB writes, no PII).

const PRODUCT_SEARCH = "/product/202309/products/search";
const PAGE_SIZE = 100;
const MAX_PAGES = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { conn, error } = await ensureShopInfo(userId);
  if (!conn?.access_token || !conn.shop_cipher) {
    return NextResponse.json({ ok: false, error: error ?? "not_connected" }, { status: 400 });
  }
  const debug = searchParams.get("debug") === "1";

  // collected[sku_id] = product/variant to upsert
  type Item = { sku: string; name: string; variant: string | null; price: number; qty: number; seller_sku: string | null };
  const collected: Item[] = [];
  let pageToken = "";
  let pages = 0;
  let sampleProductKeys: string[] = [];
  let sampleSkuKeys: string[] = [];

  try {
    for (; pages < MAX_PAGES; pages++) {
      const query: Record<string, string | number> = { page_size: PAGE_SIZE };
      if (pageToken) query.page_token = pageToken;

      const json = await tiktokRequest("POST", PRODUCT_SEARCH, conn.access_token, conn.shop_cipher, {
        query,
        body: { status: "ALL" },
      });
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: `product search: ${json.code} ${json.message ?? ""}`.trim() },
          { status: 502 }
        );
      }

      const products: Any[] = json.data?.products ?? [];
      if (debug && products[0]) {
        sampleProductKeys = Object.keys(products[0]);
        sampleSkuKeys = Object.keys(products[0].skus?.[0] ?? {});
        return NextResponse.json({
          ok: true,
          dry_run: true,
          products_on_page: products.length,
          sampleProductKeys,
          sampleSkuKeys,
          sampleInventory: Object.keys(products[0].skus?.[0]?.inventory?.[0] ?? {}),
          samplePrice: Object.keys(products[0].skus?.[0]?.price ?? {}),
        });
      }

      for (const p of products) {
        for (const sku of (p.skus ?? []) as Any[]) {
          if (!sku.id) continue;
          const qty = ((sku.inventory ?? []) as Any[]).reduce(
            (s, inv) => s + Number(inv.quantity ?? 0), 0
          );
          const price = Number(sku.price?.sale_price ?? sku.price?.tax_exclusive_price ?? 0);
          const variant = ((sku.sales_attributes ?? []) as Any[])
            .map((a) => a.value_name).filter(Boolean).join(", ") || null;
          collected.push({
            sku: String(sku.id),
            name: p.title ?? "(ไม่มีชื่อ)",
            variant,
            price: isFinite(price) ? price : 0,
            qty,
            seller_sku: sku.seller_sku ?? null,
          });
        }
      }

      pageToken = json.data?.next_page_token ?? "";
      if (!pageToken) break;
    }

    // Load existing products for this user → sku→id map.
    const { data: existing } = await supabaseAdmin
      .from("products")
      .select("id, sku")
      .eq("user_id", userId);
    const skuToId = new Map<string, string>();
    for (const e of existing ?? []) if (e.sku) skuToId.set(String(e.sku), e.id);

    let inserted = 0;
    let updated = 0;

    // Update existing (stock + price only — preserve user edits).
    for (const it of collected) {
      const id = skuToId.get(it.sku);
      if (!id) continue;
      await supabaseAdmin
        .from("products")
        .update({ stock_qty: it.qty, sell_price: it.price })
        .eq("id", id);
      updated++;
    }

    // Insert new SKUs.
    const toInsert = collected.filter((it) => !skuToId.has(it.sku));
    if (toInsert.length) {
      const { data: ins } = await supabaseAdmin
        .from("products")
        .insert(
          toInsert.map((it) => ({
            user_id: userId,
            sku: it.sku,
            name: it.name,
            category: "สินค้า TikTok",
            unit: "ชิ้น",
            cost_price: 0, // unknown — user edits
            sell_price: it.price,
            stock_qty: it.qty,
            low_stock_at: 5,
            is_active: true,
            attr1_type: it.variant ? "ตัวเลือก" : null,
            attr1_val: it.variant,
          }))
        )
        .select("id, sku");
      for (const r of ins ?? []) if (r.sku) skuToId.set(String(r.sku), r.id);
      inserted = ins?.length ?? 0;
    }

    // Upsert tiktok platform mappings (platform_name unique per user+platform).
    const mappings = collected
      .map((it) => {
        const pid = skuToId.get(it.sku);
        if (!pid) return null;
        const platform_name = it.variant ? `${it.name} | ${it.variant}` : it.name;
        return { user_id: userId, product_id: pid, platform: "tiktok", platform_name };
      })
      .filter(Boolean) as Record<string, unknown>[];

    let mapped = 0;
    for (let i = 0; i < mappings.length; i += 100) {
      const chunk = mappings.slice(i, i + 100);
      const { error: mErr } = await supabaseAdmin
        .from("product_platform_names")
        .upsert(chunk, { onConflict: "user_id,platform,platform_name", ignoreDuplicates: true });
      if (!mErr) mapped += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      shop: conn.shop_name,
      pages,
      skus_seen: collected.length,
      products_inserted: inserted,
      products_updated: updated,
      mappings_upserted: mapped,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
