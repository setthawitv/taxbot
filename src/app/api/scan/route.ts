import { NextRequest, NextResponse } from "next/server";
import { readReceipt as datalabRead } from "@/lib/datalab";
import { readReceipt as groqRead }    from "@/lib/groq";
import { authorizeUserId } from "@/lib/auth";

// POST /api/scan  { lineUserId, imageBase64, forceType? }
// Returns OCR data only — does NOT save to DB or Sheets.
// The caller is responsible for saving via POST /api/transactions after user review.
//
// Priority:  Datalab OCR → Groq vision (fallback)
export async function POST(req: NextRequest) {
  try {
    // Require an authenticated session — OCR/AI calls cost money, so this must
    // not be open to anonymous callers.
    const authed = await authorizeUserId();
    if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { imageBase64, forceType } = await req.json();
    if (!imageBase64)
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });

    // Strip data-url prefix if present
    const base64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

    let receipt;

    // 1. Try Datalab OCR (best accuracy for Thai bank slips)
    if (process.env.DATALAB_API_KEY) {
      try {
        receipt = await datalabRead(base64);
        console.log("[scan] used Datalab OCR");
      } catch (datalabErr) {
        console.warn("[scan] Datalab failed, falling back to Groq:", datalabErr);
      }
    }

    // 2. Fallback: Groq vision
    if (!receipt) {
      receipt = await groqRead(base64);
      console.log("[scan] used Groq vision");
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
