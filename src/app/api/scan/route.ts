import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readReceipt } from "@/lib/groq";
import { appendTransaction } from "@/lib/sheets";
import { google } from "googleapis";

async function getFreshToken(userId: string, access: string, refresh: string | null) {
  if (!refresh) return access;
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);
    auth.setCredentials({ refresh_token: refresh });
    const { credentials } = await auth.refreshAccessToken();
    const fresh = credentials.access_token ?? access;
    if (fresh && fresh !== access) {
      await supabaseAdmin.from("users").update({ google_access_token: fresh }).eq("id", userId);
    }
    return fresh as string;
  } catch { return access; }
}

// POST /api/scan  { lineUserId, imageBase64 }
export async function POST(req: NextRequest) {
  try {
    const { lineUserId, imageBase64 } = await req.json();
    if (!lineUserId || !imageBase64)
      return NextResponse.json({ error: "Missing lineUserId or imageBase64" }, { status: 400 });

    // Resolve user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, google_refresh_token, sheet_id")
      .eq("line_user_id", lineUserId)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Strip data-url prefix if present
    const base64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    // Call AI
    const receipt = await readReceipt(base64);

    // Save to DB
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id:          user.id,
        type:             receipt.type,
        amount:           receipt.amount,
        vendor:           receipt.vendor,
        description:      receipt.description || receipt.vendor,
        transaction_date: receipt.date,
      })
      .select("id")
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    // Sync to Sheets
    let sheetSynced = false;
    if (user.google_access_token && user.sheet_id) {
      try {
        const token = await getFreshToken(user.id, user.google_access_token, user.google_refresh_token ?? null);
        await appendTransaction(token, user.sheet_id, { ...receipt, transactionId: tx.id }, tx.id);
        sheetSynced = true;
      } catch (e) {
        console.error("[scan] sheet sync failed:", e);
      }
    }

    return NextResponse.json({ receipt, id: tx.id, sheetSynced });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
