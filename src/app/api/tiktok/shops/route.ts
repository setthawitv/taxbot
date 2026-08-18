import { NextRequest, NextResponse } from "next/server";
import { authorizeUserId } from "@/lib/auth";
import { ensureShopInfo } from "@/lib/tiktok-token";

// GET /api/tiktok/shops?userId=xxx
// Fetches the authorized shop from TikTok and backfills shop_id + shop_cipher
// (needed by every business API call). Also useful for verifying that request
// signing works against the live API. Returns booleans/ids only — never the cipher.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { conn, error } = await ensureShopInfo(userId);
  return NextResponse.json({
    ok: !error && !!conn?.shop_cipher,
    shop_id: conn?.shop_id ?? null,
    shop_name: conn?.shop_name ?? null,
    region: conn?.region ?? null,
    has_cipher: !!conn?.shop_cipher,
    error: error ?? null,
  });
}
