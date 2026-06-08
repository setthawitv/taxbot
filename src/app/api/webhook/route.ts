import { validateSignature, messagingApi, webhook } from "@line/bot-sdk";
import { NextRequest, NextResponse } from "next/server";

const { MessagingApiClient } = messagingApi;

const client = new MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.vendeefinance.com";

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

  await client.replyMessage({
    replyToken: msg.replyToken,
    messages: [{
      type: "text",
      text: `สวัสดีครับ! 👋\nเปิดแอป Vendee Finance เพื่อดูรายรับ-รายจ่าย คำนวณภาษี และสแกนสลิปได้เลย\n\n📱 ${APP_URL}`,
    }],
  });
}
