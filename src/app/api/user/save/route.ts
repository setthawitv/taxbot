import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSheet } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  try {
    const {
      lineUserId,
      firstName,
      lastName,
      businessType,
      businessName,
      phone,
      vatRegistered,
      googleAccessToken,
      googleEmail,
    } = await req.json();

    if (!lineUserId) {
      return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
    }

    // Check if user already exists (to preserve sheet_id)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id")
      .eq("line_user_id", lineUserId)
      .single();

    let sheetId = existing?.sheet_id;

    // Create Google Sheet if token provided and no sheet yet
    if (!sheetId && googleAccessToken) {
      sheetId = await createSheet(googleAccessToken, businessName || "ธุรกิจของฉัน");
    }

    // Upsert user with all fields
    const { error } = await supabaseAdmin.from("users").upsert(
      {
        line_user_id: lineUserId,
        first_name: firstName ?? null,
        last_name: lastName ?? null,
        business_type: businessType ?? null,
        business_name: businessName ?? null,
        phone: phone ?? null,
        vat_registered: vatRegistered ?? false,
        google_access_token: googleAccessToken ?? null,
        google_email: googleEmail ?? null,
        sheet_id: sheetId ?? null,
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
