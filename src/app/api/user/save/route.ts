import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSheet } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const { lineUserId, googleAccessToken, googleEmail, businessName } = await req.json();

    if (!lineUserId || !googleAccessToken) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id")
      .eq("line_user_id", lineUserId)
      .single();

    let sheetId = existing?.sheet_id;

    // Create Google Sheet if user doesn't have one yet
    if (!sheetId) {
      sheetId = await createSheet(googleAccessToken, businessName || "ธุรกิจของฉัน");
    }

    // Upsert user record
    const { error } = await supabaseAdmin.from("users").upsert(
      {
        line_user_id: lineUserId,
        google_access_token: googleAccessToken,
        google_email: googleEmail,
        sheet_id: sheetId,
        business_name: businessName,
      },
      { onConflict: "line_user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true, sheetId });
  } catch (err) {
    console.error("Error saving user:", err);
    return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
  }
}
