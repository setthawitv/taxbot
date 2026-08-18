import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureShopInfo } from "@/lib/tiktok-token";
import { tiktokRequest } from "@/lib/tiktok";

// POST /api/tiktok/sync?userId=xxx&days=90&debug=1
// Phase 1 (read-only): pull recent TikTok Shop orders into platform_orders.
// Idempotent — upserts on (user_id, line_key); re-running never duplicates.
//
// Each TikTok line_item is one physical unit, so one platform_orders row = one
// unit sold. Income (/api/income/summary) sums platform_orders.amount.

const ORDER_SEARCH = "/order/202309/orders/search";
const PAGE_SIZE = 50;
const MAX_PAGES = 40; // safety cap (~2000 orders/run)

// Statuses that represent a real, paid sale (skip UNPAID / CANCELLED).
const COUNTED = new Set([
  "AWAITING_SHIPMENT",
  "AWAITING_COLLECTION",
  "PARTIALLY_SHIPPING",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// Triggerable via POST (from the app) or GET (easy browser/cron trigger); the
// upsert is idempotent so either verb is safe to re-run.
export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { conn, error } = await ensureShopInfo(userId);
  if (!conn?.access_token || !conn.shop_cipher) {
    return NextResponse.json({ ok: false, error: error ?? "not_connected" }, { status: 400 });
  }

  const days = Math.min(parseInt(searchParams.get("days") ?? "90"), 365);
  const debug = searchParams.get("debug") === "1";
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - days * 86400;

  const rows: Record<string, unknown>[] = [];
  const batchId = `tiktok-sync-${new Date().toISOString().slice(0, 10)}`;
  let pageToken = "";
  let pages = 0;
  let orderCount = 0;
  let skipped = 0;
  let sampleOrderKeys: string[] = [];
  let sampleLineKeys: string[] = [];

  try {
    for (; pages < MAX_PAGES; pages++) {
      const query: Record<string, string | number> = { page_size: PAGE_SIZE, sort_field: "create_time" };
      if (pageToken) query.page_token = pageToken;

      const json = await tiktokRequest("POST", ORDER_SEARCH, conn.access_token, conn.shop_cipher, {
        query,
        body: { create_time_ge: startSec, create_time_lt: nowSec },
      });

      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: `order search: ${json.code} ${json.message ?? ""}`.trim() },
          { status: 502 }
        );
      }

      const orders: Any[] = json.data?.orders ?? [];
      if (debug && orders[0]) {
        sampleOrderKeys = Object.keys(orders[0]);
        sampleLineKeys = Object.keys(orders[0].line_items?.[0] ?? {});
      }

      for (const o of orders) {
        orderCount++;
        const status = String(o.status ?? "").toUpperCase();
        if (!COUNTED.has(status)) { skipped++; continue; }

        const orderDate = new Date(Number(o.create_time) * 1000).toISOString().slice(0, 10);
        const items: Any[] = o.line_items ?? [];
        for (const li of items) {
          const amount = Number(li.sale_price ?? li.original_price ?? 0);
          rows.push({
            user_id: userId,
            platform: "tiktok",
            order_id: String(o.id),
            sku_line_id: li.sku_id ? String(li.sku_id) : null, // SKU ID → matches products.sku
            line_key: `${o.id}-${li.id ?? rows.length}`,        // line_item id → unique per unit

            product_name: li.product_name ?? null,
            variant: li.sku_name ?? null,
            seller_sku: li.seller_sku ?? null,
            amount: isFinite(amount) ? amount : 0,
            order_date: orderDate,
            imported_at: new Date().toISOString(),
            import_batch_id: batchId,
          });
        }
      }

      pageToken = json.data?.next_page_token ?? "";
      if (!pageToken) break;
    }

    // Upsert in chunks (idempotent on user_id + line_key).
    let synced = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error: upErr } = await supabaseAdmin
        .from("platform_orders")
        .upsert(chunk, { onConflict: "user_id,line_key" });
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      synced += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      shop: conn.shop_name,
      days,
      pages,
      orders_seen: orderCount,
      orders_skipped: skipped,
      lines_synced: synced,
      ...(debug ? { sampleOrderKeys, sampleLineKeys } : {}),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
