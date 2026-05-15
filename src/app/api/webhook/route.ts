import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { readReceipt } from "@/lib/groq";
import { appendTransaction, createSheet } from "@/lib/sheets";
import { createRootFolder, ensureReceiptFolder, uploadFileToDrive } from "@/lib/drive";
import { generateReceiptPdf } from "@/lib/receipt-pdf";

const { MessagingApiClient, MessagingApiBlobClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const blobClient = new MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const isValid = validateSignature(body, process.env.LINE_CHANNEL_SECRET!, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { events }: { events: webhook.Event[] } = JSON.parse(body);
  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: webhook.Event) {
  if (event.type !== "message") return;

  const msgEvent = event as webhook.MessageEvent;
  const { message, replyToken, source } = msgEvent;

  if (!replyToken) return;

  const lineUserId = (source as { userId?: string }).userId;
  if (!lineUserId) return;

  if (message.type === "text") {
    await handleText(replyToken, lineUserId, (message as webhook.TextMessageContent).text);
  } else if (message.type === "image") {
    await handleImage(replyToken, lineUserId, message as webhook.ImageMessageContent);
  }
}

async function handleText(replyToken: string, lineUserId: string, text: string) {
  const lower = text.trim().toLowerCase();
  let reply = "";

  if (lower.includes("ยอด") || lower.includes("สรุป")) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();

    if (user) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data: txns } = await supabaseAdmin
        .from("transactions")
        .select("type, amount")
        .eq("user_id", user.id)
        .gte("transaction_date", firstDay)
        .lte("transaction_date", lastDay);

      const income  = txns?.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0) ?? 0;
      const expense = txns?.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0) ?? 0;

      reply = `📊 ยอดเดือนนี้\n💰 รายรับ: ฿${income.toLocaleString("th-TH")}\n🧾 รายจ่าย: ฿${expense.toLocaleString("th-TH")}\n✅ คงเหลือ: ฿${(income - expense).toLocaleString("th-TH")}`;
    } else {
      reply = "ยังไม่พบข้อมูลของคุณ กรุณาลงทะเบียนที่ลิงก์นี้ก่อนนะครับ";
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

async function handleImage(replyToken: string, lineUserId: string, msg: webhook.ImageMessageContent) {
  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: "📸 ได้รับสลิปแล้ว กำลังอ่านข้อมูล..." }],
  });

  try {
    // 1. Download image from LINE
    const stream = await blobClient.getMessageContent(msg.id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const imageBuffer = Buffer.concat(chunks);
    const base64Image = imageBuffer.toString("base64");

    // 2. AI reads the receipt
    const receipt = await readReceipt(base64Image);

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

    // 4. Apply vendor rules
    const { data: vendorRule } = await supabaseAdmin
      .from("vendor_rules")
      .select("type")
      .eq("user_id", user.id)
      .ilike("vendor_name", `%${receipt.vendor}%`)
      .limit(1)
      .single();

    if (vendorRule) receipt.type = vendorRule.type as "income" | "expense";

    // 5. Save to Supabase
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      type: receipt.type,
      amount: receipt.amount,
      vendor: receipt.vendor,
      description: receipt.description,
      transaction_date: receipt.date,
    });

    // 6. Google Drive + Sheet (only if user has connected Google)
    let driveFolderUrl: string | undefined;

    if (user.google_access_token) {
      // 6a. Ensure Google Sheet exists
      let sheetId = user.sheet_id;
      if (!sheetId) {
        sheetId = await createSheet(user.google_access_token, user.business_name ?? "ธุรกิจของฉัน");
        await supabaseAdmin.from("users").update({ sheet_id: sheetId }).eq("id", user.id);
      }

      // 6b. Ensure root Drive folder exists
      let driveFolderId = user.drive_folder_id;
      if (!driveFolderId) {
        driveFolderId = await createRootFolder(
          user.google_access_token,
          user.business_name ?? "TaxBot"
        );
        await supabaseAdmin.from("users").update({ drive_folder_id: driveFolderId }).eq("id", user.id);
      }

      // 6c. Create year/month/รวมหลักฐาน/transaction folder structure
      const { folderId, folderUrl } = await ensureReceiptFolder(
        user.google_access_token,
        driveFolderId,
        receipt.date,
        receipt.vendor
      );
      driveFolderUrl = folderUrl;

      // 6d. Upload original receipt image
      const ext   = "jpg";
      const imgName = `${receipt.date}_${receipt.vendor.replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 30)}.${ext}`;
      await uploadFileToDrive(user.google_access_token, folderId, imgName, imageBuffer, "image/jpeg");

      // 6e. Generate and upload receipt substitute PDF
      const receiptNo = `RC-${Date.now()}`;
      const pdfBuffer = await generateReceiptPdf(
        receipt,
        user.business_name ?? "ธุรกิจของฉัน",
        receiptNo
      );
      await uploadFileToDrive(
        user.google_access_token,
        folderId,
        "ใบรับรองแทนใบเสร็จรับเงิน.pdf",
        pdfBuffer,
        "application/pdf"
      );

      // 6f. Append to Google Sheet (with Drive folder link)
      if (sheetId) {
        await appendTransaction(user.google_access_token, sheetId, receipt, driveFolderUrl);
      }
    }

    // 7. Push summary back to user
    const typeLabel = receipt.type === "income" ? "💰 รายรับ" : "🧾 รายจ่าย";
    const summary =
      `✅ บันทึกแล้วครับ!\n\n` +
      `${typeLabel}\n` +
      `ร้านค้า: ${receipt.vendor}\n` +
      `จำนวน: ฿${receipt.amount.toLocaleString("th-TH")}\n` +
      `วันที่: ${receipt.date}\n` +
      `รายละเอียด: ${receipt.description}` +
      (driveFolderUrl ? `\n\n📁 หลักฐาน: ${driveFolderUrl}` : "\n\n📊 ดูในชีทได้เลยครับ");

    await client.pushMessage({ to: lineUserId, messages: [{ type: "text", text: summary }] });
  } catch (err) {
    console.error("Error processing image:", err);
    await client.pushMessage({
      to: lineUserId,
      messages: [{ type: "text", text: "❌ อ่านสลิปไม่สำเร็จ กรุณาลองใหม่หรือส่งรูปที่ชัดกว่านี้ครับ" }],
    });
  }
}
