import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/income/summary?lineUserId=xxx&year=2026&month=4&platform=all|tiktok|shopee|lazada|manual
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId     = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  const year       = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month      = parseInt(searchParams.get("month") ?? "0"); // 0 = all months
  const platform   = searchParams.get("platform") ?? "all";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Build date range ──────────────────────────────────────────────────────
  const dateFrom = month
    ? `${year}-${String(month).padStart(2, "0")}-01`
    : `${year}-01-01`;
  const lastDay = month ? new Date(year, month, 0).getDate() : 31;
  const dateTo = month
    ? `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    : `${year}-12-31`;

  // ── Query platform_orders (tiktok / shopee / lazada) ─────────────────────
  type PlatformRow = { platform: string; amount: number; order_date: string };
  let platformRows: PlatformRow[] = [];

  if (platform !== "manual") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let poQuery: any = supabaseAdmin
      .from("platform_orders")
      .select("platform, amount, order_date")
      .eq("user_id", user.id)
      .gte("order_date", dateFrom)
      .lte("order_date", dateTo);
    if (platform !== "all") poQuery = poQuery.eq("platform", platform);
    const { data, error } = await poQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    platformRows = data ?? [];
  }

  // ── Query manual income from transactions table ───────────────────────────
  type ManualRow = { amount: number; transaction_date: string };
  let manualRows: ManualRow[] = [];

  if (platform === "all" || platform === "manual") {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("amount, transaction_date")
      .eq("user_id", user.id)
      .eq("type", "income")
      .gte("transaction_date", dateFrom)
      .lte("transaction_date", dateTo);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    manualRows = data ?? [];
  }

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const platformTotal = platformRows.reduce((s, r) => s + Number(r.amount), 0);
  const manualTotal   = manualRows.reduce((s, r) => s + Number(r.amount), 0);
  const total = platformTotal + manualTotal;
  const count = platformRows.length + manualRows.length;

  // By platform breakdown
  const byPlatform: Record<string, number> = {};
  for (const r of platformRows) {
    byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + Number(r.amount);
  }
  if (manualTotal !== 0) {
    byPlatform["manual"] = manualTotal;
  }

  // By month (for bar chart)
  const byMonth: { month: number; total: number }[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: 0,
  }));
  for (const r of platformRows) {
    const m = new Date(r.order_date).getMonth();
    byMonth[m].total += Number(r.amount);
  }
  for (const r of manualRows) {
    const m = new Date(r.transaction_date).getMonth();
    byMonth[m].total += Number(r.amount);
  }

  return NextResponse.json({ total, count, byPlatform, byMonth, year, month, platform });
}
