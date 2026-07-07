import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/scan/usage?userId=xxx&year=2026&month=6
// Returns count of AI-scanned receipts for the given month
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  const year       = parseInt(searchParams.get("year")  ?? "0");
  const month      = parseInt(searchParams.get("month") ?? "0");

  if (!lineUserId || !year || !month) {
    return NextResponse.json({ error: "Unauthorized or missing params" }, { status: 401 });
  }

  // Resolve user ID
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", lineUserId)
    .single();

  if (!user) return NextResponse.json({ count: 0 });

  // Count by created_at (when the scan happened), NOT transaction_date (date on the slip)
  // This ensures quota reflects actual scans this month, not slip dates
  const from = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const lastDay = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;

  const { count } = await supabaseAdmin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "slip_photo")
    .gte("created_at", from)
    .lte("created_at", to);

  return NextResponse.json({ count: count ?? 0 });
}
