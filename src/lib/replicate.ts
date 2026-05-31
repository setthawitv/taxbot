import Anthropic from "@anthropic-ai/sdk";
import type { ReceiptData } from "./groq";

export type { ReceiptData } from "./groq";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ──────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────

function extractJson(raw: string): string {
  const stripped = raw.replace(/```json|```/gi, "").trim();
  const start = stripped.indexOf("{");
  const end   = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return stripped.slice(start, end + 1);
  return stripped;
}

function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

// ──────────────────────────────────────────
// Step 1 — Replicate datalab-to/ocr
// ──────────────────────────────────────────

async function pollUntilDone(getUrl: string, maxWaitMs = 60_000): Promise<unknown> {
  const token = process.env.REPLICATE_API_TOKEN!;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const res    = await fetch(getUrl, { headers: { Authorization: `Bearer ${token}` } });
    const result = await res.json();
    if (result.status === "succeeded" || result.status === "failed") return result;
  }
  throw new Error("Replicate OCR timed out after 60 s");
}

function extractOCRText(output: unknown): string {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.join("\n");

  if (output && typeof output === "object") {
    const o = output as Record<string, unknown>;

    // { text: "..." }
    if (typeof o.text === "string") return o.text;

    // { pages: [{ text: "..." }] }
    if (Array.isArray(o.pages)) {
      return (o.pages as Array<Record<string, unknown>>)
        .map((p) => (typeof p.text === "string" ? p.text : JSON.stringify(p)))
        .join("\n---\n");
    }

    // { blocks: [{ text: "..." }] }
    if (Array.isArray(o.blocks)) {
      return (o.blocks as Array<Record<string, unknown>>)
        .map((b) => (typeof b.text === "string" ? b.text : ""))
        .filter(Boolean)
        .join("\n");
    }

    // Markdown / HTML string field
    if (typeof o.markdown === "string") return o.markdown;
    if (typeof o.html    === "string") return o.html;
  }

  return JSON.stringify(output);
}

async function runReplicateOCR(base64Image: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN is not set");

  const res = await fetch(
    "https://api.replicate.com/v1/models/datalab-to/ocr/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",      // wait up to 60 s for inline result
      },
      body: JSON.stringify({
        input: {
          image:     `data:image/jpeg;base64,${base64Image}`,
          languages: ["th", "en"],  // Thai + English
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Replicate request failed (${res.status}): ${err.slice(0, 300)}`);
  }

  let result = await res.json();
  console.log("[replicate] initial status:", result.status);

  // Inline wait didn't complete — poll
  if (result.status === "starting" || result.status === "processing") {
    result = await pollUntilDone(result.urls.get);
  }

  if (result.status === "failed") {
    throw new Error(`Replicate OCR failed: ${result.error}`);
  }

  const text = extractOCRText(result.output);
  console.log("[replicate] OCR text (first 500):", text.slice(0, 500));
  return text;
}

// ──────────────────────────────────────────
// Step 2 — Claude text-only parsing
// ──────────────────────────────────────────

async function parseWithClaude(ocrText: string): Promise<ReceiptData> {
  const today = new Date().toISOString().split("T")[0];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: `You are a Thai receipt/slip parser. The text below was extracted by OCR from a receipt or bank-transfer slip. Parse it into a JSON object.

RULES:
- type: ALWAYS "expense"
- vendor: the RECIPIENT of the money (destination, not sender).
  * Bank transfer slips: the destination/receiver name (bottom section), NOT the sender.
  * Store receipts: the store/business name.
- Return a single JSON object only — no markdown, no explanation.

FIELDS:
- type: "expense"
- amount: total paid (number)
- vendor: recipient name (string)
- date: "YYYY-MM-DD"  (use ${today} if not visible)
- description: short Thai description (never empty; use vendor name if nothing else)
- docType: "สลิปโอนเงิน" | "ใบเสร็จรับเงิน" | "ใบกำกับภาษี" | "อื่นๆ"
- expenseCategory: "บุคลากร & ค่าจ้าง" | "สินค้า" | "บริการ" | "ค่าขนส่ง" | "ค่าเช่า" | "อื่นๆ"
- quantity: number (default 1)
- unitPrice: number (default = amount)
- vatAmount: number (default 0)
- withholdingTax: number (default 0)
- invoiceNo: string (default "")
- invoiceName: string (default "ไม่มี")
- taxId: string (default "")
- branch: string (default "")
- transactionId: bank/payment reference printed on slip (default "")

OCR TEXT:
${ocrText}`,
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text: string }).text.trim();
  console.log("[replicate] claude parse:", raw.slice(0, 300));

  let parsed: Partial<ReceiptData> = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new Error(`Failed to parse Claude response: ${raw.slice(0, 200)}`);
  }

  if (!parsed.amount || !parsed.vendor) {
    throw new Error("Parsed receipt missing required fields (amount, vendor)");
  }

  return {
    type:            parsed.type === "income" ? "income" : "expense",
    amount:          safeNum(parsed.amount),
    vendor:          String(parsed.vendor ?? "ไม่ระบุ"),
    date:            String(parsed.date ?? today),
    description:     String(parsed.description ?? ""),
    docType:         String(parsed.docType ?? "อื่นๆ"),
    expenseCategory: String(parsed.expenseCategory ?? "อื่นๆ"),
    quantity:        safeNum(parsed.quantity, 1) || 1,
    unitPrice:       safeNum(parsed.unitPrice) || safeNum(parsed.amount),
    vatAmount:       safeNum(parsed.vatAmount, 0),
    withholdingTax:  safeNum(parsed.withholdingTax, 0),
    invoiceNo:       String(parsed.invoiceNo ?? ""),
    invoiceName:     String(parsed.invoiceName ?? "ไม่มี"),
    taxId:           String(parsed.taxId ?? ""),
    branch:          String(parsed.branch ?? ""),
    transactionId:   String(parsed.transactionId ?? ""),
  };
}

// ──────────────────────────────────────────
// Step 2 fallback — Groq parse (if no Anthropic key)
// ──────────────────────────────────────────

async function parseWithGroqFallback(ocrText: string): Promise<ReceiptData> {
  // Re-use Groq's readReceipt by injecting the OCR text as a "fake" prompt
  // Actually: Groq's readReceipt expects an image, so we call Claude directly.
  // If Anthropic key is also missing, throw.
  throw new Error("ANTHROPIC_API_KEY is required to parse OCR text. Please set it in .env.local");
}

// ──────────────────────────────────────────
// Main export: Replicate OCR → Claude parse
// ──────────────────────────────────────────

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const ocrText = await runReplicateOCR(base64Image);

  if (!process.env.ANTHROPIC_API_KEY) {
    await parseWithGroqFallback(ocrText); // will throw with helpful message
  }

  return parseWithClaude(ocrText);
}
