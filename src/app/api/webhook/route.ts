import {
  Client,
  middleware,
  TextMessage,
  WebhookEvent,
  MessageEvent,
  ImageMessage,
} from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

const client = new Client(config);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  // Verify request is genuinely from LINE
  const { validateSignature } = await import("@line/bot-sdk");
  const isValid = validateSignature(body, config.channelSecret, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { events }: { events: WebhookEvent[] } = JSON.parse(body);
  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: WebhookEvent) {
  if (event.type !== "message") return;

  const msg = (event as MessageEvent).message;
  const replyToken = (event as MessageEvent).replyToken;

  if (msg.type === "text") {
    await handleText(replyToken, (msg as { type: "text"; text: string }).text);
  } else if (msg.type === "image") {
    await handleImage(replyToken, msg as ImageMessage);
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

  const message: TextMessage = { type: "text", text: reply };
  await client.replyMessage(replyToken, message);
}

async function handleImage(replyToken: string, msg: ImageMessage) {
  // Download the image from LINE
  const stream = await client.getMessageContent(msg.id);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  const imageBuffer = Buffer.concat(chunks);
  const base64Image = imageBuffer.toString("base64");

  // Placeholder — Day 3 will wire this to Claude API
  console.log(`Received image ${msg.id}, size: ${imageBuffer.length} bytes, base64 ready: ${base64Image.length > 0}`);

  const reply: TextMessage = {
    type: "text",
    text: "📸 ได้รับสลิปแล้วครับ!\n\nกำลังอ่านข้อมูล... (AI จะพร้อมใช้งานเร็วๆ นี้)\n\nตอนนี้ลองพิมพ์ \"ยอดเดือนนี้\" ดูได้เลยครับ",
  };
  await client.replyMessage(replyToken, reply);
}
