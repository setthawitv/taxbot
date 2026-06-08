import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { appendTransaction, deleteRowByTxId, updateRowByTxId } from "@/lib/sheets";
import { ensureReceiptFolder, uploadFileToDrive } from "@/lib/drive";
import { generateReceiptPdf } from "@/lib/receipt-pdf";
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

/** Resolve user.id + google tokens from either userId (UUID) or Google session email */
async function resolveUser(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? searchParams.get("lineUserId");

  if (userId) {
    const { data } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, sheet_id")
      .eq("id", userId)
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

// ── GET /api/transactions?type=income|expense&userId=&year=&month= ────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type           = searchParams.get("type");
  const paramUserId    = searchParams.get("userId") ?? searchParams.get("lineUserId");
  const year           = searchParams.get("year");
  const month          = searchParams.get("month"); // "0" or null = all months

  let userId: string | null = null;

  if (paramUserId) {
    const { data } = await supabaseAdmin
      .from("users").select("id").eq("id", paramUserId).single();
    userId = data?.id ?? null;
  } else {
    const session = await getServerSession();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data } = await supabaseAdmin
      .from("users").select("id").eq("google_email", session.user.email).single();
    userId = data?.id ?? null;
  }

  if (!userId) return NextResponse.json({ transactions: [] });

  // Build date range strings
  const yr = year && year !== "0" ? parseInt(year) : null;
  const mo = month && month !== "0" ? parseInt(month) : null;
  const dateFrom = yr ? (mo ? `${yr}-${String(mo).padStart(2,"0")}-01` : `${yr}-01-01`) : null;
  const dateTo   = yr ? (mo ? `${yr}-${String(mo).padStart(2,"0")}-${String(new Date(yr, mo!, 0).getDate()).padStart(2,"0")}` : `${yr}-12-31`) : null;

  // ── expense / all: query transactions table only ──────────────────────────
  if (type !== "income") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabaseAdmin
      .from("transactions")
      .select("id, type, amount, vendor, description, transaction_date, created_at, staff_name")
      .eq("user_id", userId)
      .order("transaction_date", { ascending: false });

    if (type) query = query.eq("type", type);
    if (dateFrom) query = query.gte("transaction_date", dateFrom).lte("transaction_date", dateTo);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data ?? [] });
  }

  // ── income: merge transactions + platform_orders ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txQuery: any = supabaseAdmin
    .from("transactions")
    .select("id, type, amount, vendor, description, transaction_date, created_at, staff_name")
    .eq("user_id", userId).eq("type", "income")
    .order("transaction_date", { ascending: false });
  if (dateFrom) txQuery = txQuery.gte("transaction_date", dateFrom).lte("transaction_date", dateTo);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let poQuery: any = supabaseAdmin
    .from("platform_orders")
    .select("id, platform, order_id, product_name, variant, amount, order_date, imported_at")
    .eq("user_id", userId)
    .order("order_date", { ascending: false });
  if (dateFrom) poQuery = poQuery.gte("order_date", dateFrom).lte("order_date", dateTo);

  const [txRes, poRes] = await Promise.all([txQuery, poQuery]);

  if (txRes.error) return NextResponse.json({ error: txRes.error.message }, { status: 500 });
  if (poRes.error) return NextResponse.json({ error: poRes.error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platformTxns = (poRes.data ?? []).map((o: any) => ({
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

// ── POST /api/transactions — manual income or expense entry ──────────────────
export async function POST(req: NextRequest) {
  try {
    const body        = await req.json();
    const lineUserId  = (body.userId ?? body.lineUserId) as string | undefined;
    const staffCode   = body.staffCode   as string | undefined; // staff entry via invite code
    const staffName   = body.staffName   as string | undefined;
    const txType      = (body.type ?? "expense") === "income" ? "income" : "expense";
    const amount      = Number(body.amount);
    const vendor      = String(body.vendor ?? "").trim();
    const description = String(body.description ?? "").trim();
    const date        = String(body.date ?? new Date().toISOString().slice(0, 10));
    const category       = String(body.expenseCategory ?? body.incomeCategory ?? "อื่นๆ").trim();
    const imageBase64    = typeof body.imageBase64 === "string" ? body.imageBase64 : null;
    const source         = typeof body.source        === "string" ? body.source        : "manual";
    const vatAmount      = Number(body.vatAmount      ?? 0);
    const withholdingTax = Number(body.withholdingTax ?? 0);
    const invoiceNo      = typeof body.invoiceNo      === "string" ? body.invoiceNo      : "";
    const taxId          = typeof body.taxId          === "string" ? body.taxId          : "";

    if (!lineUserId && !staffCode)
      return NextResponse.json({ error: "Missing lineUserId or staffCode" }, { status: 400 });
    if (!amount || amount === 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    if (!vendor)      return NextResponse.json({ error: "Missing vendor" }, { status: 400 });

    // Resolve user — either by lineUserId or via staffCode (staff entry)
    let user: {
      id: string;
      google_access_token: string | null;
      google_refresh_token: string | null;
      sheet_id: string | null;
      drive_folder_id: string | null;
      business_name: string | null;
    } | null = null;

    if (staffCode) {
      // Verify invite code and find owner
      const { data: invite } = await supabaseAdmin
        .from("staff_invites")
        .select("owner_user_id, is_active")
        .eq("code", staffCode)
        .single();
      if (!invite || !invite.is_active)
        return NextResponse.json({ error: "Invalid or disabled invite code" }, { status: 403 });

      const { data: owner } = await supabaseAdmin
        .from("users")
        .select("id, google_access_token, google_refresh_token, sheet_id, drive_folder_id, business_name")
        .eq("id", invite.owner_user_id)
        .single();
      user = owner;
    } else {
      const { data: owner } = await supabaseAdmin
        .from("users")
        .select("id, google_access_token, google_refresh_token, sheet_id, drive_folder_id, business_name")
        .eq("id", lineUserId!)
        .single();
      user = owner;
    }

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Save to transactions
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id:          user.id,
        type:             txType,
        amount,
        vendor,
        description:      description || vendor,
        transaction_date: date,
        ...(source         ? { source }                                         : {}),
        ...(vatAmount      ? { vat_amount:      vatAmount      }               : {}),
        ...(withholdingTax ? { withholding_tax: withholdingTax }               : {}),
        ...(invoiceNo      ? { invoice_no:      invoiceNo      }               : {}),
        ...(taxId          ? { tax_id:          taxId          }               : {}),
        ...(staffCode ? { staff_code: staffCode, staff_name: staffName ?? "Staff" } : {}),
      })
      .select("id")
      .single();

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

    // Build receipt data (used for both Sheets + PDF)
    const receiptData: ReceiptData = {
      type:            txType,
      amount,
      vendor,
      date,
      description:     description || vendor,
      docType:         "ใบเสร็จ",
      expenseCategory: category,
      quantity:        1,
      unitPrice:       amount,
      vatAmount:       0,
      withholdingTax:  0,
      invoiceNo:       "",
      invoiceName:     vendor,
      taxId:           "",
      branch:          "",
      transactionId:   tx.id,
    };

    let sheetSynced  = false;
    let driveSynced  = false;
    let sheetError   = "";
    let driveError   = "";

    if (!user.google_access_token) {
      sheetError = driveError = "no_token";
    } else if (!user.sheet_id && !user.drive_folder_id) {
      sheetError = driveError = "no_sheet_or_folder";
    } else {
      const gToken = await getFreshGoogleToken(user.id, user.google_access_token, user.google_refresh_token ?? null);

      // Sync to Google Sheets
      if (user.sheet_id) {
        try {
          await appendTransaction(gToken, user.sheet_id, receiptData, tx.id);
          sheetSynced = true;
        } catch (e) {
          sheetError = e instanceof Error ? e.message : String(e);
          console.error("[transactions POST] sheet sync failed:", sheetError);
        }
      } else {
        sheetError = "no_sheet_id";
      }

      // Upload to Google Drive — EXPENSE ONLY (income doesn't need Drive artifacts)
      if (txType === "income") {
        driveSynced = true; // mark as "complete" — nothing to upload
      } else if (user.drive_folder_id) {
        try {
          const bizName   = user.business_name || "ธุรกิจของฉัน";
          const receiptNo = tx.id.slice(0, 8).toUpperCase();
          const { folderId, accountingFolderId } = await ensureReceiptFolder(
            gToken,
            user.drive_folder_id,
            date,
            vendor
          );
          const safeVendor = vendor.replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 40);
          const baseName   = `${date}_${safeVendor}_${receiptNo}`;

          // รวมหลักฐาน: store ORIGINAL receipt image (no PDF generated here)
          if (imageBase64) {
            const [meta, b64] = imageBase64.split(",");
            const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
            const ext  = mime.split("/")[1]?.split("+")[0] ?? "jpg";
            const imgBuffer = Buffer.from(b64, "base64");
            await uploadFileToDrive(gToken, folderId, `${baseName}.${ext}`, imgBuffer, mime);
          }
          // (if no image was scanned — รวมหลักฐาน stays empty for this entry)

          // สำหรับสำนักงานบัญชี: ALWAYS generate + upload PDF
          const pdfBuffer = await generateReceiptPdf(receiptData, bizName, receiptNo);
          await uploadFileToDrive(gToken, accountingFolderId, `${baseName}.pdf`, pdfBuffer, "application/pdf");

          driveSynced = true;
        } catch (e) {
          driveError = e instanceof Error ? e.message : String(e);
          console.error("[transactions POST] drive upload failed:", driveError);
        }
      } else {
        driveError = "no_drive_folder_id";
      }
    }

    return NextResponse.json({ ok: true, id: tx.id, sheetSynced, driveSynced, sheetError, driveError });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── DELETE /api/transactions — remove a transaction or platform order ─────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, table } = body;
    const lineUserId = body.userId ?? body.lineUserId;
    if (!id || !lineUserId) return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, google_refresh_token, sheet_id")
      .eq("id", lineUserId)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (table === "platform_orders") {
      const { error } = await supabaseAdmin
        .from("platform_orders").delete().eq("id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from("transactions").delete().eq("id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Sync deletion to Google Sheets
      let sheetDeleted = false;
      if (user.google_access_token && user.sheet_id) {
        try {
          const gToken = await getFreshGoogleToken(user.id, user.google_access_token, user.google_refresh_token ?? null);
          await deleteRowByTxId(gToken, user.sheet_id, id);
          sheetDeleted = true;
        } catch (e) {
          console.error("[transactions DELETE] sheet sync failed:", e);
        }
      }
      return NextResponse.json({ ok: true, sheetDeleted });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ── PATCH /api/transactions — edit a transaction ──────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const body2 = await req.json();
    const { id, amount, vendor, description, date } = body2;
    const lineUserId = body2.userId ?? body2.lineUserId;
    if (!id || !lineUserId) return NextResponse.json({ error: "Missing id or userId" }, { status: 400 });

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, google_access_token, google_refresh_token, sheet_id")
      .eq("id", lineUserId)
      .single();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const newAmount      = Number(amount);
    const newVendor      = String(vendor      ?? "").trim();
    const newDescription = String(description ?? "").trim();
    const newDate        = String(date);

    const { error } = await supabaseAdmin
      .from("transactions")
      .update({
        amount:           newAmount,
        vendor:           newVendor,
        description:      newDescription,
        transaction_date: newDate,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Sync update to Google Sheets
    if (user.google_access_token && user.sheet_id) {
      try {
        const gToken = await getFreshGoogleToken(user.id, user.google_access_token, user.google_refresh_token ?? null);
        await updateRowByTxId(gToken, user.sheet_id, id, {
          date:        newDate,
          description: newDescription || newVendor,
          amount:      newAmount,
          vendor:      newVendor,
        });
      } catch (e) {
        console.error("[transactions PATCH] sheet sync failed:", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
