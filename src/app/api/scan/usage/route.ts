import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/scan/usage?lineUserId=xxx&year=2026&month=6
// Returns count of AI-scanned receipts for the given month
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");
  const year       = parseInt(searchParams.get("year")  ?? "0");
  const month      = parseInt(searchParams.get("month") ?? "0");

  if (!lineUserId || !year || !month) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  // Resolve user ID
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("line_user_id", lineUserId)
    .single();

  if (!user) return NextResponse.json({ count: 0 });

  // Count transactions created from slip scan this month
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to   = new Date(year, month, 0).toISOString().slice(0, 10); // last day of month

  const { count } = await supabaseAdmin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "slip_photo")
    .gte("transaction_date", from)
    .lte("transaction_date", to);

  return NextResponse.json({ count: count ?? 0 });
}
