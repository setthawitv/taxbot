import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabase";
import { readReceipt, ReceiptData } from "@/lib/groq";
import { appendTransaction, createSheet } from "@/lib/sheets";
import { createRootFolder, ensureReceiptFolder, uploadFileToDrive } from "@/lib/drive";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

/**
 * Returns a fresh Google access token by forcing a refresh via the refresh token.
 * We never store expiry_date, so getAccessToken() won't know the token is stale —
 * instead we always call refreshAccessToken() to guarantee a valid token.
 * Saves the new token back to Supabase so future calls also work.
 */
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
    // Only set the refresh token — don't pass the stale access token
    auth.setCredentials({ refresh_token: refreshToken });

    // Force-refresh to always get a new valid access token
    const { credentials } = await auth.refreshAccessToken();
    const fresh = credentials.access_token ?? accessToken;

    if (fresh && fresh !== accessToken) {
      console.log("[google-auth] token refreshed, saving new access token...");
      await supabaseAdmin
        .from("users")
        .update({ google_access_token: fresh })
        .eq("id", userId);
    }
    return fresh ?? accessToken;
  } catch (err) {
    console.error("[google-auth] refresh failed:", err);
    return accessToken;   // fall back to existing token
  }
}

const { MessagingApiClient, MessagingApiBlobClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});
const blobClient = new MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

// ─── Webhook entry ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { events }: { events: webhook.Event[] } = JSON.parse(body);
  await Promise.all(events.map(handleEvent));
  return NextResponse.json({ ok: true });
}

// ─── Event router ─────────────────────────────────────────────────────────────
async function handleEvent(event: webhook.Event) {
  if (event.type === "message") {
    const msg = event as webhook.MessageEvent;
    if (!msg.replyToken) return;
    const lineUserId = (msg.source as { userId?: string }).userId;
    if (!lineUserId) return;

    // Save latest LINE profile (display_name, picture_url) in background
    client.getProfile(lineUserId).then((profile) => {
      supabaseAdmin
        .from("users")
        .update({ display_name: profile.displayName, picture_url: profile.pictureUrl ?? null })
        .eq("line_user_id", lineUserId)
        .then(() => {});
    }).catch(() => {});

    if (msg.message.type === "text") {
      await handleText(msg.replyToken, lineUserId, (msg.message as webhook.TextMessageContent).text);
    } else if (msg.message.type === "image") {
      await handleImage(msg.replyToken, lineUserId, msg.message as webhook.ImageMessageContent);
    }
  } else if (event.type === "postback") {
    const pb = event as webhook.PostbackEvent;
    if (!pb.replyToken) return;
    const lineUserId = (pb.source as { userId?: string }).userId;
    if (!lineUserId) return;
    await handlePostback(pb.replyToken, lineUserId, pb.postback.data);
  }
}

// ─── Text handler ─────────────────────────────────────────────────────────────
async function handleText(replyToken: string, lineUserId: string, text: string) {
  const lower = text.trim().toLowerCase();
  let reply = "";

  if (lower.includes("ยอด") || lower.includes("สรุป")) {
    const { data: user } = await supabaseAdmin
      .from("users").select("id").eq("line_user_id", lineUserId).single();

    if (user) {
      const now      = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const { data: txns } = await supabaseAdmin
        .from("transactions").select("type, amount")
        .eq("user_id", user.id).gte("transaction_date", firstDay).lte("transaction_date", lastDay);

      const income  = txns?.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
      const expense = txns?.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;
      reply = `📊 ยอดเดือนนี้\n💰 รายรับ: ฿${income.toLocaleString("th-TH")}\n🧾 รายจ่าย: ฿${expense.toLocaleString("th-TH")}\n✅ คงเหลือ: ฿${(income - expense).toLocaleString("th-TH")}`;
    } else {
      reply = "ยังไม่พบข้อมูลของคุณ กรุณาลงทะเบียนก่อนนะครับ";
    }
  } else if (lower.includes("ภาษี")) {
    reply = "🧾 สรุปภาษีเบื้องต้น\nกรุณาดูรายละเอียดใน Mini App ของเราครับ";
  } else if (lower.includes("สวัสดี") || lower.includes("hello") || lower.includes("hi")) {
    reply = "สวัสดีครับ! 👋\nผมคือ TaxBot ช่วยบันทึกรายรับ-รายจ่ายและสรุปภาษีให้คุณ\n\nส่งสลิปหรือใบเสร็จมาได้เลยครับ 📸";
  } else {
    reply =
      "สามารถส่งคำสั่งเหล่านี้ได้เลยครับ:\n\n" +
      "📸 ส่งรูปสลิป → AI อ่านให้อัตโนมัติ\n" +
      "💬 \"ยอดเดือนนี้\" → ดูสรุปรายรับ-รายจ่าย\n" +
      "💬 \"ภาษี\" → ดูสรุปภาษีเบื้องต้น";
  }

  await client.replyMessage({ replyToken, messages: [{ type: "text", text: reply }] });
}

// ─── Image handler — read receipt & ask for confirmation ──────────────────────
async function handleImage(
  replyToken: string,
  lineUserId: string,
  msg: webhook.ImageMessageContent
) {
  // Show typing indicator (up to 60 s) while processing
  await client.showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 60 }).catch(() => null);

  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: "📸 ได้รับสลิปแล้ว กำลังอ่านข้อมูล..." }],
  });

  try {
    // 1. Download image
    console.log("[webhook] downloading image", msg.id);
    const stream = await blobClient.getMessageContent(msg.id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const imageBuffer = Buffer.concat(chunks);
    console.log("[webhook] image size (original):", imageBuffer.length);

    // Compress to max 1024px JPEG — prevents 400 Bad Request on large KBank screenshots
    let compressedBuffer: Buffer = imageBuffer;
    try {
      const sharpResult = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      compressedBuffer = Buffer.from(sharpResult);
      console.log("[webhook] compressed:", imageBuffer.length, "→", compressedBuffer.length, "bytes");
    } catch (sharpErr) {
      console.error("[webhook] sharp failed, using original:", sharpErr);
    }

    const base64Image = compressedBuffer.toString("base64");

    // 2. AI reads receipt
    console.log("[webhook] calling readReceipt...");
    const receipt = await readReceipt(base64Image);
    console.log("[webhook] receipt:", JSON.stringify(receipt));

    // 3. Look up user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id, drive_folder_id, google_access_token, business_name")
      .eq("line_user_id", lineUserId)
      .single();

    if (!user) {
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: "text", text: "ไม่พบบัญชีของคุณ กรุณาลงทะเบียนที่ Web App ก่อนนะครับ" }],
      });
      return;
    }

    // 4. Image receipts are always expenses (income comes from PDF/Excel only)
    receipt.type = "expense";

    // 4b. Apply vendor rules
    const { data: vendorRule } = await supabaseAdmin
      .from("vendor_rules").select("type")
      .eq("user_id", user.id).ilike("vendor_name", `%${receipt.vendor}%`)
      .limit(1).single();
    if (vendorRule) receipt.type = vendorRule.type as "income" | "expense";

    // 4b. Duplicate detection — check by bank transaction ID
    if (receipt.transactionId) {
      const { data: dup } = await supabaseAdmin
        .from("transactions")
        .select("id, transaction_date, amount")
        .eq("user_id", user.id)
        .eq("external_transaction_id", receipt.transactionId)
        .single();

      if (dup) {
        await client.pushMessage({
          to: lineUserId,
          messages: [{
            type: "text",
            text: `⚠️ สลิปนี้เคยบันทึกแล้วครับ!\n\nTransaction ID: ${receipt.transactionId}\nวันที่: ${dup.transaction_date}\nจำนวน: ฿${Number(dup.amount).toLocaleString("th-TH")}\n\nหากต้องการบันทึกใหม่กรุณาติดต่อผู้ดูแลระบบครับ`,
          }],
        });
        return;
      }
    }

    // 5. Save as pending (awaiting user confirmation)
    const { data: pendingRow, error: pendingErr } = await supabaseAdmin
      .from("pending_receipts")
      .insert({ user_id: user.id, receipt_data: receipt, image_base64: base64Image })
      .select("id")
      .single();

    if (pendingErr) throw pendingErr;

    // 6. Send confirmation Flex Message
    await client.pushMessage({
      to: lineUserId,
      messages: [buildConfirmFlex(receipt, pendingRow!.id)],
    });

  } catch (err) {
    const msg2 = errMsg(err);
    console.error("[webhook] handleImage error:", msg2, err);
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: "text", text: `❌ อ่านสลิปไม่สำเร็จครับ\n${msg2.slice(0, 120)}\n\nกรุณาลองใหม่ครับ` }],
    });
  }
}

// ─── Postback handler — confirm or cancel ─────────────────────────────────────
async function handlePostback(replyToken: string, lineUserId: string, data: string) {
  if (data.startsWith("confirm_")) {
    const pendingId = data.slice("confirm_".length);
    await client.showLoadingAnimation({ chatId: lineUserId, loadingSeconds: 60 }).catch(() => null);
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "⏳ กำลังบันทึกข้อมูล..." }],
    });
    await processConfirmedReceipt(lineUserId, pendingId);

  } else if (data.startsWith("cancel_")) {
    const pendingId = data.slice("cancel_".length);
    await supabaseAdmin.from("pending_receipts").delete().eq("id", pendingId);
    await client.replyMessage({
      replyToken,
      messages: [{ type: "text", text: "❌ ยกเลิกแล้วครับ\nส่งรูปสลิปใหม่ได้เลยนะครับ 📸" }],
    });
  }
}

// ─── Process confirmed receipt — save to Supabase + Drive + Sheet ─────────────
async function processConfirmedReceipt(lineUserId: string, pendingId: string) {
  try {
    // Fetch pending record
    const { data: pending, error: fetchErr } = await supabaseAdmin
      .from("pending_receipts")
      .select("user_id, receipt_data, image_base64")
      .eq("id", pendingId)
      .single();

    if (fetchErr || !pending) {
      await client.pushMessage({
        to: lineUserId,
        messages: [{ type: "text", text: "❌ ไม่พบข้อมูลที่รอยืนยัน อาจหมดอายุแล้วครับ" }],
      });
      return;
    }

    const receipt     = pending.receipt_data as ReceiptData;
    const imageBuffer = Buffer.from(pending.image_base64, "base64");

    // Look up user
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id, sheet_id, drive_folder_id, google_access_token, google_refresh_token, business_name")
      .eq("line_user_id", lineUserId)
      .single();

    if (!user) throw new Error("user not found");

    // Save to transactions
    const { data: txRow, error: txErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id:                  user.id,
        type:                     receipt.type,
        amount:                   receipt.amount,
        vendor:                   receipt.vendor,
        description:              receipt.description,
        transaction_date:         receipt.date,
        external_transaction_id:  receipt.transactionId || null,
      })
      .select("id")
      .single();

    if (txErr) throw txErr;
    const txId: string = txRow?.id ?? `tx-${Date.now()}`;

    // Delete pending record
    await supabaseAdmin.from("pending_receipts").delete().eq("id", pendingId);

    // Google Drive + Sheet
    let driveFolderUrl: string | undefined;
    let googleAuthExpired = false;

    if (user.google_access_token) {
      try {
        // Refresh the access token if expired
        const gToken = await getFreshGoogleToken(
          user.id,
          user.google_access_token,
          user.google_refresh_token ?? null
        );

        // Ensure Sheet exists
        let sheetId = user.sheet_id;
        if (!sheetId) {
          sheetId = await createSheet(gToken, user.business_name ?? "ธุรกิจของฉัน");
          await supabaseAdmin.from("users").update({ sheet_id: sheetId }).eq("id", user.id);
        }

        // Ensure root Drive folder exists
        let driveFolderId = user.drive_folder_id;
        if (!driveFolderId) {
          driveFolderId = await createRootFolder(gToken, user.business_name ?? "TaxBot");
          await supabaseAdmin.from("users").update({ drive_folder_id: driveFolderId }).eq("id", user.id);
        }

        // Create folder structure
        const { folderId, folderUrl, accountingFolderId } = await ensureReceiptFolder(
          gToken, driveFolderId, receipt.date, receipt.vendor
        );
        driveFolderUrl = folderUrl;

        const safeName = receipt.vendor.replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 30);
        const bizSafe  = (user.business_name ?? "TaxBot").replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 20);

        // Upload original image
        await uploadFileToDrive(
          gToken, folderId, `${receipt.date}_${safeName}.jpg`, imageBuffer, "image/jpeg"
        );

        // Generate + upload PDF to both folders
        const receiptNo = `RC-${txId.slice(0, 8).toUpperCase()}`;
        const pdfBuffer = await generateReceiptPdf(receipt, user.business_name ?? "ธุรกิจของฉัน", receiptNo);
        const pdfName   = `${receipt.date}_${safeName}_${bizSafe}_${txId.slice(0, 8)}.pdf`;

        await Promise.all([
          uploadFileToDrive(gToken, folderId,           pdfName, pdfBuffer, "application/pdf"),
          uploadFileToDrive(gToken, accountingFolderId, pdfName, pdfBuffer, "application/pdf"),
        ]);

        // Append to Sheet
        if (sheetId) {
          await appendTransaction(gToken, sheetId, receipt, txId);
        }
      } catch (gErr) {
        const gMsg = errMsg(gErr);
        console.error("[webhook] Google Drive/Sheet error:", gMsg);
        // If token expired / auth failed — flag it but don't throw; data is already in Supabase
        if (gMsg.includes("401") || gMsg.includes("invalid authentication") || gMsg.includes("Invalid Credentials")) {
          googleAuthExpired = true;
        } else {
          throw gErr; // re-throw unexpected errors
        }
      }
    }

    // Push success message
    const typeLabel = receipt.type === "income" ? "💰 รายรับ" : "🧾 รายจ่าย";
    let summary =
      `✅ บันทึกแล้วครับ!\n\n` +
      `${typeLabel}\n` +
      `ร้านค้า: ${receipt.vendor}\n` +
      `จำนวน: ฿${receipt.amount.toLocaleString("th-TH")}\n` +
      `วันที่: ${receipt.date}\n` +
      `รายละเอียด: ${receipt.description || "-"}`;

    if (googleAuthExpired) {
      summary += `\n\n⚠️ บันทึกใน TaxBot แล้ว แต่ยังอัปโหลดไปยัง Google Drive/Sheet ไม่ได้\nกรุณาเชื่อมต่อ Google ใหม่อีกครั้งที่ Settings ครับ`;
    } else {
      summary += driveFolderUrl ? `\n\n📁 หลักฐาน: ${driveFolderUrl}` : "\n\n📊 ดูในชีทได้เลยครับ";
    }

    await client.pushMessage({ to: lineUserId, messages: [{ type: "text", text: summary }] });

  } catch (err) {
    const msg2 = errMsg(err);
    console.error("[webhook] processConfirmed error:", msg2, err);
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: "text", text: `❌ บันทึกไม่สำเร็จครับ\n${msg2.slice(0, 120)}` }],
    });
  }
}

/** Safely extract a readable message from any thrown value */
function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    // Supabase errors have { message, details, code }
    const e = err as Record<string, unknown>;
    return String(e.message ?? e.details ?? e.code ?? JSON.stringify(err));
  }
  return String(err);
}

// ─── Flex Message builder ─────────────────────────────────────────────────────
function buildConfirmFlex(receipt: ReceiptData, pendingId: string): messagingApi.FlexMessage {
  const isExpense  = receipt.type === "expense";
  const typeLabel  = isExpense ? "🧾 รายจ่าย" : "💰 รายรับ";
  const headerColor = isExpense ? "#C0392B" : "#27AE60";
  const vendorLabel = isExpense ? "ผู้รับเงิน" : "ผู้ชำระเงิน";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function row(label: string, value: string): any {
    return {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "text", text: label, color: "#888888", size: "sm", flex: 3 },
        { type: "text", text: value, size: "sm", flex: 4, wrap: true, align: "end", weight: "bold" },
      ],
    };
  }

  return {
    type: "flex",
    altText: `ตรวจสอบข้อมูล: ${receipt.vendor} ฿${receipt.amount.toLocaleString("th-TH")}`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📋 ตรวจสอบข้อมูลสลิป", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: typeLabel, color: "#FFFFFF", size: "sm", margin: "xs" },
        ],
      } as messagingApi.FlexBox,
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          row(vendorLabel,     receipt.vendor  || "-"),
          row("จำนวนเงิน",     `฿${receipt.amount.toLocaleString("th-TH")}`),
          row("วันที่",         receipt.date    || "-"),
          row("รายละเอียด",    receipt.description || "-"),
          row("ประเภทเอกสาร",  receipt.docType || "-"),
          row("หมวดหมู่",      receipt.expenseCategory || "-"),
          ...(receipt.transactionId
            ? [row("Transaction ID", receipt.transactionId)]
            : []),
          { type: "separator", margin: "md" },
          { type: "text", text: "ข้อมูลถูกต้องไหมครับ?", size: "sm", color: "#555555",
            margin: "md", align: "center" },
        ],
      } as messagingApi.FlexBox,
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            flex: 1,
            style: "primary",
            color: "#27AE60",
            action: {
              type: "postback",
              label: "✅ ยืนยัน",
              data: `confirm_${pendingId}`,
              displayText: "ยืนยันข้อมูล",
            },
          },
          {
            type: "button",
            flex: 1,
            style: "secondary",
            action: {
              type: "postback",
              label: "❌ ยกเลิก",
              data: `cancel_${pendingId}`,
              displayText: "ยกเลิก",
            },
          },
        ],
      } as messagingApi.FlexBox,
    } as messagingApi.FlexBubble,
  };
}
