import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Check if a LINE user has connected their Google account
export async function GET(req: NextRequest) {
  const lineUserId = req.nextUrl.searchParams.get("lineUserId");
  if (!lineUserId) {
    return NextResponse.json({ connected: false });
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select("google_access_token, google_email")
    .eq("line_user_id", lineUserId)
    .single();

  return NextResponse.json({
    connected: !!data?.google_access_token,
    email: data?.google_email ?? null,
  });
}
