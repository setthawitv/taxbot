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
  "You are a Thai receipt/slip reader.",
  "Extract data from the image and reply with a single JSON object only — no explanation, no markdown, no extra text.",
  "",
  "Required JSON fields:",
  '- type: "income" or "expense"',
  "- amount: total paid as a number",
  "- vendor: the name of the RECIPIENT (who is receiving the money). For bank transfer slips, this is the DESTINATION account holder shown at the bottom of the arrow, NOT the sender at the top.",
  '- date: "YYYY-MM-DD"',
  "- description: short Thai description",
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

  const rawText = await callWithFallback(base64Image, today);

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
