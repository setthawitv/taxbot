import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { appendTransaction } from "@/lib/sheets";
import { google } from "googleapis";
import type { ReceiptData } from "@/lib/groq";
import { authorizeUserId } from "@/lib/auth";

// ── Refresh Google access token (same pattern as webhook) ────────────────────
async function getFreshGoogleToken(
  userId: string,
  accessToken: string,
  refreshToken: string | null
): Promise<string> {
  if (!refreshToken) return accessToken;
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!
    );
    auth.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await auth.refreshAccessToken();
    const fresh = credentials.access_token ?? accessToken;

    if (fresh && fresh !== accessToken) {
      await supabaseAdmin
        .from("users")
        .update({ google_access_token: fresh })
        .eq("id", userId);
    }
    return fresh as string;
  } catch (e) {
    console.error("[sync/sheets] token refresh failed:", e);
    return accessToken;
  }
}

// ── Read all transaction IDs already in the Sheet (column B "ไอดี") ────────────
async function getExistingSheetIds(accessToken: string, sheetId: string): Promise<Set<string>> {
  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "รวม!B:B",
    });

    const values = res.data.values ?? [];
    return new Set(values.slice(1).map((row) => String(row[0] ?? "")).filter(Boolean));
  } catch {
    return new Set();
  }
}

// POST /api/sync/sheets
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const lineUserId = await authorizeUserId(body.userId ?? body.lineUserId);
    if (!lineUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get user with Google tokens
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, google_refresh_token, sheet_id")
      .eq("id", lineUserId)
      .single();

    if (!user)                     return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (!user.google_access_token) return NextResponse.json({ error: "Google not connected" }, { status: 400 });
    if (!user.sheet_id)            return NextResponse.json({ error: "No sheet found — send a receipt via LINE first" }, { status: 400 });

    // Always refresh token before using
    const gToken = await getFreshGoogleToken(
      user.id,
      user.google_access_token,
      user.google_refresh_token ?? null
    );

    // Fetch all expense transactions from DB
    const { data: txns, error } = await supabaseAdmin
      .from("transactions")
      .select("id, amount, vendor, description, transaction_date")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .order("transaction_date", { ascending: true });

    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });

    // Get IDs already in the Sheet to avoid duplicates
    const existingIds = await getExistingSheetIds(gToken, user.sheet_id);

    // Filter to only unsynced rows
    const toSync = (txns ?? []).filter((t) => !existingIds.has(t.id));

    if (toSync.length === 0) {
      return NextResponse.json({
        ok:      true,
        synced:  0,
        failed:  0,
        skipped: existingIds.size,
        message: "ข้อมูลทั้งหมดอยู่ใน Sheets แล้ว",
      });
    }

    let synced    = 0;
    let failed    = 0;
    let lastError = "";

    for (const t of toSync) {
      try {
        // Ensure date is YYYY-MM-DD (Supabase returns this format, but guard anyway)
        const date = String(t.transaction_date).slice(0, 10);

        const receiptData: ReceiptData = {
          type:            "expense",
          amount:          Number(t.amount),
          vendor:          t.vendor   ?? "",
          date,
          description:     t.description ?? t.vendor ?? "",
          docType:         "ใบเสร็จ",
          expenseCategory: "อื่นๆ",
          quantity:        1,
          unitPrice:       Number(t.amount),
          vatAmount:       0,
          withholdingTax:  0,
          invoiceNo:       "",
          invoiceName:     t.vendor ?? "",
          taxId:           "",
          branch:          "",
          transactionId:   t.id,
        };
        await appendTransaction(gToken, user.sheet_id, receiptData, t.id);
        synced++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sync/sheets] failed tx ${t.id}:`, msg);
        lastError = msg;
        failed++;
      }
    }

    return NextResponse.json({
      ok:        true,
      synced,
      failed,
      skipped:   existingIds.size,
      lastError: failed > 0 ? lastError : undefined,
      message:   `ซิงค์แล้ว ${synced} รายการ${failed > 0 ? ` (ล้มเหลว ${failed})` : ""}`,
    });

  } catch (err: unknown) {
    console.error("[sync/sheets] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
