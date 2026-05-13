import {
  validateSignature,
  messagingApi,
  webhook,
} from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";

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

  const msg = (event as webhook.MessageEvent).message;
  const replyToken = (event as webhook.MessageEvent).replyToken;

  if (!replyToken) return;

  if (msg.type === "text") {
    await handleText(replyToken, (msg as webhook.TextMessageContent).text);
  } else if (msg.type === "image") {
    await handleImage(replyToken, msg as webhook.ImageMessageContent);
  }
}

async function handleText(replyToken: string, text: string) {
  const lower = text.trim().toLowerCase();

  let reply = "";

  if (lower.includes("ยอด") || lower.includes("สรุป")) {
    reply = "📊 ยอดเดือนนี้\nรายรับ: ฿0\nรายจ่าย: ฿0\nคงเหลือ: ฿0\n\n(ยังไม่มีข้อมูล ลองส่งสลิปมาก่อนได้เลย)";
  } else if (lower.includes("ภาษี")) {
    reply = "🧾 สรุปภาษีเบื้องต้น\nยังไม่มีข้อมูลเพียงพอในการคำนวณภาษี\n\nกรุณาบันทึกรายรับ-รายจ่ายก่อนนะครับ";
  } else if (lower.includes("สวัสดี") || lower.includes("hello") || lower.includes("hi")) {
    reply = "สวัสดีครับ! 👋\nผมคือ TaxBot ช่วยบันทึกรายรับ-รายจ่ายและสรุปภาษีให้คุณ\n\nส่งสลิปหรือใบเสร็จมาได้เลยครับ 📸";
  } else {
    reply =
      "สามารถส่งคำสั่งเหล่านี้ได้เลยครับ:\n\n" +
      "📸 ส่งรูปสลิป → AI อ่านให้อัตโนมัติ\n" +
      "💬 \"ยอดเดือนนี้\" → ดูสรุปรายรับ-รายจ่าย\n" +
      "💬 \"ภาษี\" → ดูสรุปภาษีเบื้องต้น";
  }

  await client.replyMessage({
    replyToken,
    messages: [{ type: "text", text: reply }],
  });
}

async function handleImage(replyToken: string, msg: webhook.ImageMessageContent) {
  // Download image from LINE — Day 3 will pass this to Claude API
  const stream = await blobClient.getMessageContent(msg.id);
  const buffer = await stream.arrayBuffer();
  const base64Image = Buffer.from(buffer).toString("base64");

  console.log(`Received image ${msg.id}, size: ${buffer.byteLength} bytes, base64 ready: ${base64Image.length > 0}`);

  await client.replyMessage({
    replyToken,
    messages: [
      {
        type: "text",
        text: "📸 ได้รับสลิปแล้วครับ!\n\nกำลังอ่านข้อมูล... (AI จะพร้อมใช้งานเร็วๆ นี้)\n\nตอนนี้ลองพิมพ์ \"ยอดเดือนนี้\" ดูได้เลยครับ",
      },
    ],
  });
}
