import { NextResponse } from "next/server";
import { ImageResponse } from "next/og";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const APP_URL = process.env.NEXTAUTH_URL ?? "https://taxbot-sage.vercel.app";

const SECTIONS = [
  { emoji: "💰", label: "รายรับ",  color: "#059669", href: `${APP_URL}/rairab` },
  { emoji: "🧾", label: "รายจ่าย", color: "#dc2626", href: `${APP_URL}/raijhai` },
  { emoji: "📊", label: "ภาษี",   color: "#2563eb", href: `${APP_URL}/phasi` },
  { emoji: "⚙️", label: "ตั้งค่า", color: "#374151", href: `${APP_URL}/settings` },
];

async function loadThaiFont(): Promise<ArrayBuffer | null> {
  try {
    // Fetch Google Fonts CSS to get the real woff2 URL
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Sarabun:wght@700&subset=thai",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36" } }
    ).then((r) => r.text());

    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
    if (!match) return null;

    return fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

async function buildImage(): Promise<ArrayBuffer> {
  const fontData = await loadThaiFont();

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          flexWrap: "wrap",
          fontFamily: "Sarabun",
        }}
      >
        {SECTIONS.map((s, i) => (
          <div
            key={i}
            style={{
              width: "50%",
              height: "50%",
              background: s.color,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "24px",
              borderRight: i % 2 === 0 ? "6px solid rgba(255,255,255,0.25)" : "none",
              borderBottom: i < 2 ? "6px solid rgba(255,255,255,0.25)" : "none",
            }}
          >
            <div style={{ fontSize: 160, lineHeight: 1 }}>{s.emoji}</div>
            <div style={{ fontSize: 96, color: "white", fontWeight: 700 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    ),
    {
      width: 2500,
      height: 1686,
      ...(fontData ? { fonts: [{ name: "Sarabun", data: fontData, style: "normal" as const, weight: 700 as const }] } : {}),
    }
  );

  return response.arrayBuffer();
}

const RICH_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "TaxBot Menu",
  chatBarText: "เมนู TaxBot",
  areas: SECTIONS.map((s, i) => ({
    bounds: {
      x: i % 2 === 0 ? 0 : 1250,
      y: i < 2 ? 0 : 843,
      width: 1250,
      height: 843,
    },
    action: { type: "uri", label: s.label, uri: s.href },
  })),
};

export async function POST() {
  try {
    // 1. Create Rich Menu structure
    const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(RICH_MENU),
    });

    if (!createRes.ok) {
      return NextResponse.json({ error: "Create failed", detail: await createRes.text() }, { status: 500 });
    }

    const { richMenuId } = await createRes.json();

    // 2. Generate and upload image
    const imageBuffer = await buildImage();
    const uploadRes = await fetch(
      `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "image/png" },
        body: imageBuffer,
      }
    );

    if (!uploadRes.ok) {
      return NextResponse.json({ error: "Upload failed", detail: await uploadRes.text() }, { status: 500 });
    }

    // 3. Set as default for all users
    const setRes = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    if (!setRes.ok) {
      return NextResponse.json({ error: "Set default failed", detail: await setRes.text() }, { status: 500 });
    }

    return NextResponse.json({ ok: true, richMenuId });
  } catch (err) {
    console.error("setup-richmenu error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
