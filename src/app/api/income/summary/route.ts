import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/income/summary?lineUserId=xxx&year=2026&month=4&platform=tiktok
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const year       = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month      = parseInt(searchParams.get("month") ?? "0"); // 0 = all months
  const platform   = searchParams.get("platform") ?? "all";      // all|tiktok|shopee|lazada

  if (!lineUserId) {
    return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("line_user_id", lineUserId)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // ── Build date range ────────────────────────────────────────────────────────
  const dateFrom = month
    ? `${year}-${String(month).padStart(2, "0")}-01`
    : `${year}-01-01`;
  // Use actual last day of month (new Date(year, month, 0) gives last day of prev month)
  const lastDay = month ? new Date(year, month, 0).getDate() : 31;
  const dateTo = month
    ? `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    : `${year}-12-31`;

  // ── Query platform_orders ───────────────────────────────────────────────────
  let poQuery = supabaseAdmin
    .from("platform_orders")
    .select("platform, amount, order_date")
    .eq("user_id", user.id)
    .gte("order_date", dateFrom)
    .lte("order_date", dateTo);

  if (platform !== "all") poQuery = poQuery.eq("platform", platform);

  const { data: orders, error } = await poQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = orders ?? [];

  // ── Aggregate ───────────────────────────────────────────────────────────────
  const total = rows.reduce((s, r) => s + Number(r.amount), 0);
  const count = rows.length;

  // By platform
  const byPlatform: Record<string, number> = {};
  for (const r of rows) {
    byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + Number(r.amount);
  }

  // By month (for the year view)
  const byMonth: { month: number; total: number }[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    total: 0,
  }));
  for (const r of rows) {
    const m = new Date(r.order_date).getMonth(); // 0-indexed
    byMonth[m].total += Number(r.amount);
  }

  return NextResponse.json({ total, count, byPlatform, byMonth, year, month, platform });
}
