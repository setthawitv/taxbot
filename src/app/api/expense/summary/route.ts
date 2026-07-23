import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/expense/summary?lineUserId=xxx&year=2026&month=5
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId     = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  const year       = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()));
  const month      = parseInt(searchParams.get("month") ?? "0"); // 0 = full year

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const qFrom = searchParams.get("from");
  const qTo   = searchParams.get("to");
  const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

  const dateFrom = isDate(qFrom) ? qFrom : month
    ? `${year}-${String(month).padStart(2, "0")}-01`
    : `${year}-01-01`;
  const lastDay = month ? new Date(year, month, 0).getDate() : 31;
  const dateTo = isDate(qTo) ? qTo : month
    ? `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
    : `${year}-12-31`;

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("amount")
    .eq("user_id", user.id)
    .eq("type", "expense")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (error) return NextResponse.json({ error: "Database error"}, { status: 500 });

  const total = (data ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const count = (data ?? []).length;

  return NextResponse.json({ total, count, year, month });
}
