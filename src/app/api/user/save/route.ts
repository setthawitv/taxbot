import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSheet } from "@/lib/sheets";
import { createRootFolder } from "@/lib/drive";

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
      googleRefreshToken,
      googleEmail,
    } = await req.json();

    if (!lineUserId) {
      return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
    }

    // Check if user already exists (preserve sheet_id and drive_folder_id)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id, drive_folder_id")
      .eq("line_user_id", lineUserId)
      .single();

    let sheetId       = existing?.sheet_id;
    let driveFolderId = existing?.drive_folder_id;

    if (googleAccessToken) {
      // Create Google Sheet if not yet created
      if (!sheetId) {
        sheetId = await createSheet(googleAccessToken, businessName || "ธุรกิจของฉัน");
      }
      // Create root Drive folder (TaxBot/{businessName}) if not yet created
      if (!driveFolderId) {
        driveFolderId = await createRootFolder(
          googleAccessToken,
          businessName || "ธุรกิจของฉัน"
        );
      }
    }

    // Upsert user — try with refresh token first, fall back without if column missing
    const basePayload = {
      line_user_id:          lineUserId,
      first_name:            firstName      ?? null,
      last_name:             lastName       ?? null,
      business_type:         businessType   ?? null,
      business_name:         businessName   ?? null,
      phone:                 phone          ?? null,
      vat_registered:        vatRegistered  ?? false,
      google_access_token:   googleAccessToken  ?? null,
      google_email:          googleEmail        ?? null,
      sheet_id:              sheetId        ?? null,
      drive_folder_id:       driveFolderId  ?? null,
    };

    let { error } = await supabaseAdmin.from("users").upsert(
      { ...basePayload, google_refresh_token: googleRefreshToken ?? null },
      { onConflict: "line_user_id" }
    );

    // If google_refresh_token column doesn't exist yet, retry without it
    if (error && (String(error.message ?? "").includes("google_refresh_token") || String(error.code ?? "") === "PGRST204")) {
      console.warn("[user/save] google_refresh_token column missing, saving without it");
      ({ error } = await supabaseAdmin.from("users").upsert(basePayload, { onConflict: "line_user_id" }));
    }

    if (error) throw error;

    return NextResponse.json({ ok: true, sheetId });
  } catch (err) {
    console.error("Error saving user:", err);
    return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
  }
}
