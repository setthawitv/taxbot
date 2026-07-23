import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createSheet } from "@/lib/sheets";
import { createRootFolder } from "@/lib/drive";
import { authorizeUserId, getSessionEmail } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const {
      userId: bodyUserId,
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

    // If a Supabase UUID is provided directly (e.g. from settings reconnect flow), update by id.
    // The caller must own (or admin) that account — otherwise anyone could
    // overwrite another user's Google tokens and hijack their Drive/Sheets.
    if (bodyUserId && !lineUserId) {
      const authedId = await authorizeUserId(bodyUserId);
      if (!authedId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const updates: Record<string, unknown> = {};
      if (googleAccessToken  !== undefined) updates.google_access_token  = googleAccessToken;
      if (googleRefreshToken !== undefined) updates.google_refresh_token = googleRefreshToken;
      // Always store email lowercased so lookups (which lowercase the query) match.
      if (googleEmail        !== undefined) updates.google_email         = typeof googleEmail === "string" ? googleEmail.toLowerCase().trim() : null;
      const { error } = await supabaseAdmin.from("users").update(updates).eq("id", authedId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // For Google-only users (no LINE), derive identity from the AUTHENTICATED
    // session — never trust a client-supplied email, or one user could create
    // or overwrite another account's row by passing someone else's email.
    const sessionEmail = await getSessionEmail();
    // Canonical email is always lowercased, so it matches by-email / auth lookups.
    let effectiveGoogleEmail: string | null =
      typeof googleEmail === "string" ? googleEmail.toLowerCase().trim() : null;
    let resolvedLineUserId: string = lineUserId;
    if (!resolvedLineUserId) {
      if (!sessionEmail) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      effectiveGoogleEmail = sessionEmail;
      resolvedLineUserId = `google_${sessionEmail.replace(/[@.+]/g, "_")}`;
    }

    // Check if user already exists (preserve sheet_id and drive_folder_id)
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id, drive_folder_id")
      .eq("line_user_id", resolvedLineUserId)
      .single();

    let sheetId       = existing?.sheet_id;
    let driveFolderId = existing?.drive_folder_id;

    if (googleAccessToken) {
      // Create Google Sheet if not yet created
      if (!sheetId) {
        sheetId = await createSheet(googleAccessToken, businessName || "ธุรกิจของฉัน");
      }
      // Create root Drive folder (Vendee Finance/{businessName}) if not yet created
      if (!driveFolderId) {
        driveFolderId = await createRootFolder(
          googleAccessToken,
          businessName || "ธุรกิจของฉัน"
        );
      }
    }

    // Upsert user — try with refresh token first, fall back without if column missing
    const basePayload = {
      line_user_id:          resolvedLineUserId,
      first_name:            firstName      ?? null,
      last_name:             lastName       ?? null,
      business_type:         businessType   ?? null,
      business_name:         businessName   ?? null,
      phone:                 phone          ?? null,
      vat_registered:        vatRegistered  ?? false,
      google_access_token:   googleAccessToken  ?? null,
      google_email:          effectiveGoogleEmail,
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
