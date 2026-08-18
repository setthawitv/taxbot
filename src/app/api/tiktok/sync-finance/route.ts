import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { ensureShopInfo } from "@/lib/tiktok-token";
import { tiktokRequest } from "@/lib/tiktok";

// GET/POST /api/tiktok/sync-finance?userId=xxx&days=90&debug=1
// Pulls TikTok settlement statements (revenue / fees / adjustments / net) into
// platform_settlements. Powers the "เงินเข้าจริง หลังหักค่าธรรมเนียม" figure.
// Idempotent on (user_id, platform, statement_id).
// debug=1 → dry run, returns statement field names only (no writes).

const STATEMENTS = "/finance/202501/statements";
const PAGE_SIZE = 50;
const MAX_PAGES = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

const num = (v: unknown) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

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
  let pageToken = "";
  let pages = 0;

  try {
    for (; pages < MAX_PAGES; pages++) {
      const query: Record<string, string | number> = {
        page_size: PAGE_SIZE,
        sort_field: "statement_time",
        statement_time_ge: startSec,
        statement_time_lt: nowSec,
      };
      if (pageToken) query.page_token = pageToken;

      const json = await tiktokRequest("GET", STATEMENTS, conn.access_token, conn.shop_cipher, { query });
      if (json.code !== 0) {
        return NextResponse.json(
          { ok: false, error: `statements: ${json.code} ${json.message ?? ""}`.trim() },
          { status: 502 }
        );
      }

      const statements: Any[] = json.data?.statements ?? [];
      if (debug) {
        return NextResponse.json({
          ok: true,
          dry_run: true,
          statements_on_page: statements.length,
          sampleStatementKeys: Object.keys(statements[0] ?? {}),
          sample: statements[0] ?? null, // amounts only, no PII
        });
      }

      for (const s of statements) {
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

    const totals = rows.reduce(
      (a, r) => ({
        revenue: a.revenue + num(r.revenue_amount),
        fee: a.fee + num(r.fee_amount),
        adjustment: a.adjustment + num(r.adjustment_amount),
        net: a.net + num(r.settlement_amount),
      }),
      { revenue: 0, fee: 0, adjustment: 0, net: 0 }
    );

    return NextResponse.json({ ok: true, shop: conn.shop_name, days, statements: synced, totals });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
