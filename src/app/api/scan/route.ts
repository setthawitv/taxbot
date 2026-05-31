import { NextRequest, NextResponse } from "next/server";
import { readReceipt as replicateRead } from "@/lib/replicate";
import { readReceipt as groqRead }     from "@/lib/groq";

// POST /api/scan  { lineUserId, imageBase64, forceType? }
// Returns OCR data only — does NOT save to DB or Sheets.
// The caller is responsible for saving via POST /api/transactions after user review.
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, forceType } = await req.json();
    if (!imageBase64)
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });

    // Strip data-url prefix if present
    const base64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    // Call AI — Replicate OCR first, Groq as fallback
    let receipt;
    try {
      receipt = await replicateRead(base64);
    } catch (replicateErr) {
      console.warn("[scan] Replicate OCR failed, falling back to Groq:", replicateErr);
      receipt = await groqRead(base64);
    }

    // Override type if caller specifies
    if (forceType === "income" || forceType === "expense") {
      receipt = { ...receipt, type: forceType };
    }

    return NextResponse.json({ receipt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
