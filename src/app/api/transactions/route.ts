import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { appendTransaction } from "@/lib/sheets";
import { google } from "googleapis";
import type { ReceiptData } from "@/lib/groq";

async function getFreshGoogleToken(userId: string, accessToken: string, refreshToken: string | null): Promise<string> {
  if (!refreshToken) return accessToken;
  try {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!);
    auth.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await auth.refreshAccessToken();
    const fresh = credentials.access_token ?? accessToken;
    if (fresh && fresh !== accessToken) {
      await supabaseAdmin.from("users").update({ google_access_token: fresh }).eq("id", userId);
    }
    return fresh as string;
  } catch { return accessToken; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function platformLabel(platform: string): string {
  if (platform === "tiktok") return "TikTok Shop";
  if (platform === "shopee") return "Shopee";
  if (platform === "lazada") return "Lazada";
  return platform;
}

/** Resolve user.id + google tokens from either lineUserId or Google session email */
async function resolveUser(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lineUserId = searchParams.get("lineUserId");

  if (lineUserId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, sheet_id")
      .eq("line_user_id", lineUserId)
      .single();
    return data ?? null;
  }

  // Fallback: Google session
  const session = await getServerSession();
  if (!session?.user?.email) return null;

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, google_access_token, sheet_id")
    .eq("google_email", session.user.email)
    .single();
  return data ?? null;
}

// ── GET /api/transactions?type=income|expense&lineUserId=xxx ──────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type       = searchParams.get("type");
  const lineUserId = searchParams.get("lineUserId");

  let userId: string | null = null;

  if (lineUserId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();
    userId = data?.id ?? null;
  } else {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("google_email", session.user.email)
      .single();
    userId = data?.id ?? null;
  }

  if (!userId) return NextResponse.json({ transactions: [] });

  // ── expense / all: query transactions table only ──────────────────────────
  if (type !== "income") {
    let query = supabaseAdmin
      .from("transactions")
      .select("id, type, amount, vendor, description, transaction_date, created_at")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (type) query = query.eq("type", type);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data ?? [] });
  }

  // ── income: merge transactions + platform_orders ──────────────────────────
  const [txRes, poRes] = await Promise.all([
    supabaseAdmin
      .from("transactions")
      .select("id, type, amount, vendor, description, transaction_date, created_at")
      .eq("user_id", userId)
      .eq("type", "income")
      .order("transaction_date", { ascending: false }),

    supabaseAdmin
      .from("platform_orders")
      .select("id, platform, order_id, product_name, variant, amount, order_date, imported_at")
      .eq("user_id", userId)
      .order("order_date", { ascending: false }),
  ]);

  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });
  if (poRes.error) return NextResponse.json({ error: poRes.error.message }, { status: 500 });

  const platformTxns = (poRes.data ?? []).map((o) => ({
    id:               o.id,
    type:             "income" as const,
    amount:           o.amount,
    vendor:           platformLabel(o.platform),
    description:      o.variant ? `${o.product_name} (${o.variant})` : o.product_name,
    transaction_date: o.order_date,
    created_at:       o.imported_at,
    source:           o.platform,
    order_id:         o.order_id,
  }));

  const all = [...(txRes.data ?? []), ...platformTxns].sort(
    (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
  );

  return NextResponse.json({ transactions: all });
}

// ── POST /api/transactions — manual expense entry ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body        = await req.json();
    const lineUserId  = body.lineUserId as string | undefined;
    const amount      = Number(body.amount);
    const vendor      = String(body.vendor ?? "").trim();
    const description = String(body.description ?? "").trim();
    const date        = String(body.date ?? new Date().toISOString().slice(0, 10));
    const category    = String(body.expenseCategory ?? "อื่นๆ").trim();

    if (!lineUserId)  return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });
    if (!amount || amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!vendor)      return NextResponse.json({ error: "Missing vendor" }, { status: 400 });

    // Resolve user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, google_refresh_token, sheet_id")
      .eq("line_user_id", lineUserId)
      .single();

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Save to transactions
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id:          user.id,
        type:             "expense",
        amount,
        vendor,
        description:      description || vendor,
        transaction_date: date,
      })
      .select("id")
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    // Sync to Google Sheets if connected
    let sheetSynced = false;
    if (user.google_access_token && user.sheet_id) {
      try {
        const gToken = await getFreshGoogleToken(user.id, user.google_access_token, user.google_refresh_token ?? null);
        const receiptData: ReceiptData = {
          type:             "expense",
          amount,
          vendor,
          date,
          description:      description || vendor,
          docType:          "ใบเสร็จ",
          expenseCategory:  category,
          quantity:         1,
          unitPrice:        amount,
          vatAmount:        0,
          withholdingTax:   0,
          invoiceNo:        "",
          invoiceName:      vendor,
          taxId:            "",
          branch:           "",
          transactionId:    tx.id,
        };
        await appendTransaction(gToken, user.sheet_id, receiptData, tx.id);
        sheetSynced = true;
      } catch (e) {
        console.error("[transactions POST] sheet sync failed:", e);
      }
    }

    return NextResponse.json({ ok: true, id: tx.id, sheetSynced });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
