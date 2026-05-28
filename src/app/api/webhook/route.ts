import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const { MessagingApiClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://taxbot-sage.vercel.app";

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
  if (event.type !== "message") return;

  const msg = event as webhook.MessageEvent;
  if (!msg.replyToken) return;
  const lineUserId = (msg.source as { userId?: string }).userId;
  if (!lineUserId) return;

  // Save latest LINE profile in background
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
    // Receipt scanning is done via the web app
    await client.replyMessage({
      replyToken: msg.replyToken,
      messages: [{
        type: "text",
        text: `📸 อัปโหลดสลิปผ่านแอปได้เลยครับ\n\n👉 ${APP_URL}/scan\n\nเปิดลิงก์ → เลือกรูป → AI อ่านให้อัตโนมัติ ✨`,
      }],
    });
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
      reply =
        `📊 ยอดเดือนนี้\n` +
        `💰 รายรับ: ฿${income.toLocaleString("th-TH")}\n` +
        `🧾 รายจ่าย: ฿${expense.toLocaleString("th-TH")}\n` +
        `✅ คงเหลือ: ฿${(income - expense).toLocaleString("th-TH")}\n\n` +
        `📱 ดูรายละเอียดเพิ่มเติม: ${APP_URL}`;
    } else {
      reply = "ยังไม่พบข้อมูลของคุณ กรุณาลงทะเบียนที่แอปก่อนนะครับ";
    }

  } else if (lower.includes("ภาษี")) {
    reply = `🧾 ดูสรุปภาษีเบื้องต้นได้ที่แอปครับ\n\n👉 ${APP_URL}/phasi`;

  } else if (lower.includes("สแกน") || lower.includes("อัปโหลด") || lower.includes("สลิป") || lower.includes("ใบเสร็จ")) {
    reply = `📸 อัปโหลดสลิป/ใบเสร็จผ่านแอปได้เลยครับ\n\n👉 ${APP_URL}/scan\n\nเปิดลิงก์ → เลือกรูป → AI อ่านให้อัตโนมัติ ✨`;

  } else if (lower.includes("สวัสดี") || lower.includes("hello") || lower.includes("hi")) {
    reply =
      `สวัสดีครับ! 👋\nผมคือ TaxBot ช่วยบันทึกรายรับ-รายจ่ายและสรุปภาษีให้คุณครับ\n\n` +
      `📱 เปิดแอป: ${APP_URL}`;

  } else {
    reply =
      `สามารถใช้คำสั่งเหล่านี้ได้เลยครับ:\n\n` +
      `📸 "สแกนสลิป" → ลิงก์อัปโหลดสลิป\n` +
      `💬 "ยอดเดือนนี้" → ดูสรุปรายรับ-รายจ่าย\n` +
      `💬 "ภาษี" → ดูสรุปภาษีเบื้องต้น\n\n` +
      `📱 หรือเปิดแอปได้เลย: ${APP_URL}`;
  }

  await client.replyMessage({ replyToken, messages: [{ type: "text", text: reply }] });
}
