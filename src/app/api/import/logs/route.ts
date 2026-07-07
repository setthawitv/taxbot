import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/import/logs?userId=xxx&limit=50
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("import_logs")
    .select("id, platform, filename, order_count, new_count, total_amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}
