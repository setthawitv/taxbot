import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Vision models to try in order — fallback if one fails
const VISION_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
  "llama-3.2-11b-vision-preview",
  "llama-3.2-90b-vision-preview",
];

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;
  vendor: string;          // RECIPIENT of the money (destination), not the sender
  date: string;            // YYYY-MM-DD
  description: string;
  docType: string;
  expenseCategory: string;
  quantity: number;
  unitPrice: number;
  vatAmount: number;
  withholdingTax: number;
  invoiceNo: string;
  invoiceName: string;
  taxId: string;
  branch: string;
  transactionId: string;   // bank Transaction ID printed on slip
};

/** Extract the first {...} JSON block from a string. */
function extractJson(raw: string): string {
  const stripped = raw.replace(/```json|```/gi, "").trim();
  const start = stripped.indexOf("{");
  const end   = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }
  return stripped;
}

/** Safe number coercion that keeps 0 as 0. */
function safeNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

const PROMPT_LINES = [
  "You are a Thai receipt/slip reader for an e-commerce business owner.",
  "Extract data from the image and reply with a single JSON object only — no explanation, no markdown, no extra text.",
  "",
  "IMPORTANT RULES:",
  '- type: ALWAYS "expense" for any image slip or receipt. Income comes from other sources, not image slips.',
  "- vendor: the RECIPIENT of the money — the person/business RECEIVING payment.",
  "  * For bank transfer slips (สลิปโอนเงิน): the recipient is the name shown at the BOTTOM (destination). The sender is at the TOP — do NOT use the top name.",
  "  * For store receipts/invoices: the store/business name is the vendor.",
  "",
  "Required JSON fields:",
  '- type: always "expense"',
  "- amount: total paid as a number",
  "- vendor: recipient name (BOTTOM name on transfer slips, store name on receipts)",
  '- date: ALWAYS return Gregorian (AD) "YYYY-MM-DD". Use these rules to convert the year:',
  '  * Format "DD MMM YY": read as Day=DD, Month=MMM, Year=20YY (AD). "24 May 26" → 2026-05-24. "3 Jun 26" → 2026-06-03.',
  '  * 2-digit year 20–30 → it is the last 2 digits of an AD year → prepend "20". "26"→2026, "25"→2025.',
  '  * 2-digit year 60–69 → it is the last 2 digits of a Thai BE year → full BE = 25YY → AD = 25YY−543. "67"→BE2567→AD2024.',
  '  * 4-digit year ≥ 2500 → Thai BE → subtract 543 to get AD.',
  '  * 4-digit year 2024–2030 → already AD, use as-is.',
  '  * When in doubt, pick the year closest to Today\'s date.',
  "- description: short Thai description (e.g. 'โอนเงิน', 'ค่าสินค้า', 'ชำระค่าบริการ' — never leave empty; use vendor name if nothing else)",
  '- docType: "สลิปโอนเงิน" or "ใบเสร็จรับเงิน" or "ใบกำกับภาษี" or "อื่นๆ"',
  '- expenseCategory: "บุคลากร & ค่าจ้าง" or "สินค้า" or "บริการ" or "ค่าขนส่ง" or "ค่าเช่า" or "อื่นๆ"',
  "- quantity: number (default 1)",
  "- unitPrice: number (default = amount)",
  "- vatAmount: number (default 0)",
  "- withholdingTax: number (default 0)",
  '- invoiceNo: string (default "")',
  '- invoiceName: string (default "ไม่มี")',
  '- taxId: string (default "")',
  '- branch: string (default "")',
  '- transactionId: the bank/payment Transaction ID or reference number printed on the slip (e.g. "016132211009DPP00161") — empty string if not visible',
];

/** Try each vision model in order, return on first success. */
async function callWithFallback(base64Image: string, today: string): Promise<string> {
  let lastError: unknown;

  for (const model of VISION_MODELS) {
    try {
      console.log(`[groq] trying model: ${model}`);
      const response = await client.chat.completions.create({
        model,
        max_tokens: 600,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}` },
              },
              {
                type: "text",
                text: [
                  ...PROMPT_LINES,
                  "",
                  `Today's date: ${today}`,
                ].join("\n"),
              },
            ],
          },
        ],
      });

      const text = response.choices[0].message.content?.trim() ?? "";
      console.log(`[groq] success with ${model}:`, text.slice(0, 200));
      return text;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(`[groq] model ${model} failed:`, msg);
      lastError = err;

      // Only retry on 400/404/model-not-found errors, not auth/rate-limit
      if (typeof msg === "string" && (msg.includes("429") || msg.includes("401"))) {
        throw err;
      }
      // Continue to next model on 400/404
    }
  }

  throw lastError;
}

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const today = new Date().toISOString().split("T")[0];

  let rawText: string;
  try {
    rawText = await callWithFallback(base64Image, today);
  } catch (groqErr) {
    // All Groq models failed — try Claude if the key is available
    if (process.env.ANTHROPIC_API_KEY) {
      console.warn("[groq] all models failed, falling back to Claude:", groqErr);
      const { readReceipt: claudeRead } = await import("./claude");
      return claudeRead(base64Image);
    }
    throw groqErr;
  }

  let parsed: Partial<ReceiptData> = {};
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch {
    console.error("[groq] JSON parse failed. Raw text was:", rawText);
    throw new Error(`Failed to parse AI response: ${rawText.slice(0, 200)}`);
  }

  if (!parsed.amount || !parsed.vendor) {
    console.error("[groq] Missing required fields:", parsed);
    throw new Error("AI response missing required fields (amount, vendor)");
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
