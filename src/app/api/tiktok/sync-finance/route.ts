import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureShopInfo } from "@/lib/tiktok-token";
import { tiktokRequest } from "@/lib/tiktok";

// GET/POST /api/tiktok/sync-finance?userId=xxx&days=90&debug=1[&ver=202309]
// Pulls TikTok settlement statements (revenue / fees / adjustments / net) into
// platform_settlements → powers "เงินเข้าจริง หลังหักค่าธรรมเนียม".
// Auto-discovers a valid finance API version (36009004 = invalid version).
// Idempotent on (user_id, platform, statement_id). debug=1 → dry run.

const PAGE_SIZE = 50;
const MAX_PAGES = 30;
const VERSIONS = ["202309", "202405", "202409", "202501"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0; };

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
  const accessToken: string = conn.access_token;
  const shopCipher: string = conn.shop_cipher;

  const days = Math.min(parseInt(searchParams.get("days") ?? "90"), 365);
  const debug = searchParams.get("debug") === "1";
  const nowSec = Math.floor(Date.now() / 1000);
  const startSec = nowSec - days * 86400;
  const verParam = searchParams.get("ver");
  const versions: string[] = verParam ? [verParam] : VERSIONS;

  const call = (ver: string, pageToken: string) => {
    const query: Record<string, string | number> = {
      page_size: PAGE_SIZE,
      sort_field: "statement_time",
      statement_time_ge: startSec,
      statement_time_lt: nowSec,
    };
    if (pageToken) query.page_token = pageToken;
    return tiktokRequest("GET", `/finance/${ver}/statements`, accessToken, shopCipher, { query });
  };

  try {
    // 1) Discover a valid version (invalid-version → try next; other error → surface).
    let usedVer = "";
    let first: Any = null;
    for (const v of versions) {
      const json = await call(v, "");
      if (json.code === 0) { usedVer = v; first = json; break; }
      const invalidVer = json.code === 36009004 || /invalid api version/i.test(json.message ?? "");
      if (!invalidVer) {
        return NextResponse.json({ ok: false, ver: v, error: `statements: ${json.code} ${json.message ?? ""}`.trim() }, { status: 502 });
      }
    }
    if (!usedVer || !first) {
      return NextResponse.json({ ok: false, error: "no valid finance API version", tried: versions }, { status: 502 });
    }

    if (debug) {
      const statements: Any[] = first.data?.statements ?? [];
      return NextResponse.json({
        ok: true, dry_run: true, ver: usedVer,
        statements_on_page: statements.length,
        sampleStatementKeys: Object.keys(statements[0] ?? {}),
        sample: statements[0] ?? null,
      });
    }

    // 2) Paginate (first page already fetched).
    const rows: Record<string, unknown>[] = [];
    let json: Any = first;
    let pages = 0;
    let pageToken = "";
    for (; pages < MAX_PAGES; pages++) {
      for (const s of (json.data?.statements ?? []) as Any[]) {
        rows.push({
          user_id: userId,
          platform: "tiktok",
          statement_id: String(s.id ?? s.statement_id ?? ""),
          currency: s.currency ?? null,
          revenue_amount: num(s.revenue_amount),
          fee_amount: num(s.fee_amount),
          adjustment_amount: num(s.adjustment_amount),
          settlement_amount: num(s.settlement_amount),
          statement_time: s.statement_time ? new Date(Number(s.statement_time) * 1000).toISOString() : null,
          synced_at: new Date().toISOString(),
        });
      }
      pageToken = json.data?.next_page_token ?? "";
      if (!pageToken) break;
      json = await call(usedVer, pageToken);
      if (json.code !== 0) break;
    }

    let synced = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error: upErr } = await supabaseAdmin
        .from("platform_settlements")
        .upsert(chunk, { onConflict: "user_id,platform,statement_id" });
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      synced += chunk.length;
    }

    // Per-order settlements (statement_transactions) → order_settlements.
    const orderRows: Record<string, unknown>[] = [];
    const statementIds = [...new Set(rows.map((r) => String(r.statement_id)).filter(Boolean))];
    for (const sid of statementIds) {
      let tok = "";
      for (let p = 0; p < 20; p++) {
        const q: Record<string, string | number> = { page_size: 50, sort_field: "order_create_time" };
        if (tok) q.page_token = tok;
        const tj: Any = await tiktokRequest("GET", `/finance/${usedVer}/statements/${sid}/statement_transactions`, accessToken, shopCipher, { query: q });
        if (tj.code !== 0) break;
        for (const t of (tj.data?.statement_transactions ?? []) as Any[]) {
          if (!t.order_id) continue;
          orderRows.push({
            user_id: userId,
            platform: "tiktok",
            order_id: String(t.order_id),
            currency: t.currency ?? null,
            gross_amount: num(t.gross_sales_amount),
            fee_amount: num(t.fee_amount),
            adjustment_amount: num(t.adjustment_amount),
            net_amount: num(t.settlement_amount),
            order_time: t.order_create_time ? new Date(Number(t.order_create_time) * 1000).toISOString() : null,
            statement_id: sid,
            synced_at: new Date().toISOString(),
          });
        }
        tok = tj.data?.next_page_token ?? "";
        if (!tok) break;
      }
    }
    let orderSettled = 0;
    for (let i = 0; i < orderRows.length; i += 100) {
      const chunk = orderRows.slice(i, i + 100);
      const { error: oErr } = await supabaseAdmin
        .from("order_settlements")
        .upsert(chunk, { onConflict: "user_id,platform,order_id" });
      if (!oErr) orderSettled += chunk.length;
    }

    const totals = rows.reduce<{ revenue: number; fee: number; adjustment: number; net: number }>(
      (a, r) => ({
        revenue: a.revenue + num(r.revenue_amount),
        fee: a.fee + num(r.fee_amount),
        adjustment: a.adjustment + num(r.adjustment_amount),
        net: a.net + num(r.settlement_amount),
      }),
      { revenue: 0, fee: 0, adjustment: 0, net: 0 }
    );

    return NextResponse.json({ ok: true, shop: conn.shop_name, ver: usedVer, days, statements: synced, orders_settled: orderSettled, totals });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
