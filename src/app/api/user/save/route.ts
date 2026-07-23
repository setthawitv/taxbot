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

    // Resolve identity. Prefer the authenticated session email; fall back to the
    // client-supplied email. Always lowercase so it matches by-email / auth lookups.
    const sessionEmail = await getSessionEmail();
    const email =
      (typeof googleEmail === "string" ? googleEmail.toLowerCase().trim() : "") ||
      sessionEmail || "";

    // Find the existing account FIRST by email (canonical), then by the provided
    // line id. This prevents creating a duplicate row for a user who already
    // exists under a different line_user_id (e.g. legacy LINE accounts), which
    // would break the by-email lookup and bounce them back to onboarding.
    let existing: { id: string; sheet_id: string | null; drive_folder_id: string | null } | null = null;
    if (email) {
      const { data } = await supabaseAdmin
        .from("users").select("id, sheet_id, drive_folder_id")
        .eq("google_email", email)
        .order("created_at", { ascending: true })
        .limit(1);
      existing = data?.[0] ?? null;
    }
    let resolvedLineUserId: string = lineUserId;
    if (!existing) {
      if (!resolvedLineUserId) {
        if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        resolvedLineUserId = `google_${email.replace(/[@.+]/g, "_")}`;
      }
      const { data } = await supabaseAdmin
        .from("users").select("id, sheet_id, drive_folder_id")
        .eq("line_user_id", resolvedLineUserId)
        .limit(1);
      existing = data?.[0] ?? null;
    }

    let sheetId       = existing?.sheet_id ?? null;
    let driveFolderId = existing?.drive_folder_id ?? null;

    if (googleAccessToken) {
      if (!sheetId)       sheetId       = await createSheet(googleAccessToken, businessName || "ธุรกิจของฉัน");
      if (!driveFolderId) driveFolderId = await createRootFolder(googleAccessToken, businessName || "ธุรกิจของฉัน");
    }

    // Fields to write. For an existing row we update by id and never change its
    // line_user_id; for a new row we insert with the derived line id.
    const fields = {
      first_name:          firstName      ?? null,
      last_name:           lastName       ?? null,
      business_type:       businessType   ?? null,
      business_name:       businessName   ?? null,
      phone:               phone          ?? null,
      vat_registered:      vatRegistered  ?? false,
      google_access_token: googleAccessToken ?? null,
      google_email:        email || null,
      sheet_id:            sheetId,
      drive_folder_id:     driveFolderId,
    };

    const write = (payload: Record<string, unknown>) =>
      existing
        ? supabaseAdmin.from("users").update(payload).eq("id", existing.id)
        : supabaseAdmin.from("users").insert({ line_user_id: resolvedLineUserId, ...payload });

    let { error } = await write({ ...fields, google_refresh_token: googleRefreshToken ?? null });

    // If google_refresh_token column doesn't exist yet, retry without it
    if (error && (String(error.message ?? "").includes("google_refresh_token") || String(error.code ?? "") === "PGRST204")) {
      console.warn("[user/save] google_refresh_token column missing, saving without it");
      ({ error } = await write(fields));
    }

    if (error) throw error;

    return NextResponse.json({ ok: true, sheetId });
  } catch (err) {
    console.error("Error saving user:", err);
    return NextResponse.json({ error: "Failed to save user" }, { status: 500 });
  }
}
