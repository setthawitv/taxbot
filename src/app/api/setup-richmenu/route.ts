import { NextResponse } from "next/server";
import { deflateSync } from "zlib";

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const APP_URL = process.env.NEXTAUTH_URL ?? "https://taxbot-sage.vercel.app";

// ─── PNG Generator (no external deps) ────────────────────────────────────────

function crc32(buf: Buffer): number {
  const table = Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of buf) crc = (table[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (~crc) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// 2x2 grid: รายรับ(green) | รายจ่าย(red) / ภาษี(blue) | ตั้งค่า(gray)
function buildRichMenuPNG(): Buffer {
  const W = 2500, H = 1686;
  const COLORS: [number, number, number][][] = [
    [[16, 185, 129], [239, 68, 68]],   // top row: green | red
    [[59, 130, 246], [75, 85, 99]],    // bottom row: blue | gray
  ];

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 3);
    raw[row] = 0;
    const rowIdx = y < H / 2 ? 0 : 1;
    for (let x = 0; x < W; x++) {
      const colIdx = x < W / 2 ? 0 : 1;
      const [r, g, b] = COLORS[rowIdx][colIdx];

      // Draw divider lines
      const isVDivider = x >= W / 2 - 3 && x < W / 2 + 3;
      const isHDivider = y >= H / 2 - 3 && y < H / 2 + 3;
      const [fr, fg, fb] = isVDivider || isHDivider ? [255, 255, 255] : [r, g, b];

      const p = row + 1 + x * 3;
      raw[p] = fr; raw[p + 1] = fg; raw[p + 2] = fb;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Rich Menu Definition ─────────────────────────────────────────────────────

const RICH_MENU = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "TaxBot Menu",
  chatBarText: "เมนู TaxBot",
  areas: [
    {
      bounds: { x: 0, y: 0, width: 1250, height: 843 },
      action: { type: "uri", label: "รายรับ", uri: `${APP_URL}/rairab` },
    },
    {
      bounds: { x: 1250, y: 0, width: 1250, height: 843 },
      action: { type: "uri", label: "รายจ่าย", uri: `${APP_URL}/raijhai` },
    },
    {
      bounds: { x: 0, y: 843, width: 1250, height: 843 },
      action: { type: "uri", label: "ภาษี", uri: `${APP_URL}/phasi` },
    },
    {
      bounds: { x: 1250, y: 843, width: 1250, height: 843 },
      action: { type: "uri", label: "ตั้งค่า", uri: `${APP_URL}/settings` },
    },
  ],
};

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    // 1. Create Rich Menu structure
    const createRes = await fetch("https://api.line.me/v2/bot/richmenu", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(RICH_MENU),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json({ error: "Create failed", detail: err }, { status: 500 });
    }

    const { richMenuId } = await createRes.json();

    // 2. Upload Rich Menu image
    const image = buildRichMenuPNG();
    const uploadRes = await fetch(
      `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "image/png",
        },
        body: image,
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      return NextResponse.json({ error: "Upload failed", detail: err }, { status: 500 });
    }

    // 3. Set as default for all users
    const setRes = await fetch(
      `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );

    if (!setRes.ok) {
      const err = await setRes.text();
      return NextResponse.json({ error: "Set default failed", detail: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true, richMenuId });
  } catch (err) {
    console.error("setup-richmenu error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
