import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Re-export ReceiptData so webhook can import from either file
export type { ReceiptData } from "./groq";

import type { ReceiptData } from "./groq";

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

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  // Fall back to Groq if Anthropic key is not configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[claude] ANTHROPIC_API_KEY not set, falling back to Groq");
    const { readReceipt: groqRead } = await import("./groq");
    return groqRead(base64Image);
  }

  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 600,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64Image },
          },
          {
            type: "text",
            text: `You are a Thai receipt/slip reader for an e-commerce business owner. Extract data from the image and reply with a single JSON object only — no explanation, no markdown, no extra text.

IMPORTANT RULES:
- type: ALWAYS "expense" for any image slip or receipt. Income comes from other sources, not image slips.
- vendor: the RECIPIENT of the money — person/business RECEIVING payment.
  * For bank transfer slips: recipient is the name at the BOTTOM (destination). The sender is at the TOP — do NOT use the top name.
  * For store receipts/invoices: the store name is the vendor.

Required fields:
- type: always "expense"
- amount: total paid as a number
- vendor: recipient name (BOTTOM name on transfer slips, store name on receipts)
- date: "YYYY-MM-DD" (use ${today} if not visible)
- description: short Thai description (never empty — use vendor name if nothing else)
- docType: "สลิปโอนเงิน" or "ใบเสร็จรับเงิน" or "ใบกำกับภาษี" or "อื่นๆ"
- expenseCategory: "บุคลากร & ค่าจ้าง" or "สินค้า" or "บริการ" or "ค่าขนส่ง" or "ค่าเช่า" or "อื่นๆ"
- quantity: number (default 1)
- unitPrice: number (default = amount)
- vatAmount: VAT amount as number (default 0)
- withholdingTax: withholding tax as number (default 0)
- invoiceNo: tax invoice number string (default "")
- invoiceName: name on invoice (default "ไม่มี")
- taxId: vendor tax ID string (default "")
- branch: branch string (default "")
- transactionId: the bank Transaction ID / reference number printed on slip (e.g. "016132211009DPP00161"), empty string if not visible

Example: {"type":"expense","amount":250,"vendor":"NAMTALAY LAOR","date":"${today}","description":"โอนเงินผ่าน PromptPay","docType":"สลิปโอนเงิน","expenseCategory":"อื่นๆ","quantity":1,"unitPrice":250,"vatAmount":0,"withholdingTax":0,"invoiceNo":"","invoiceName":"ไม่มี","taxId":"","branch":"","transactionId":"016132211009DPP00161"}`,
          },
        ],
      },
    ],
  });

  const raw    = (response.content[0] as { type: string; text: string }).text.trim();
  console.log("[claude] raw:", raw.slice(0, 300));

  let parsed: Partial<ReceiptData> = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    console.error("[claude] JSON parse failed:", raw);
    throw new Error(`Failed to parse Claude response: ${raw.slice(0, 200)}`);
  }

  if (!parsed.amount || !parsed.vendor) {
    throw new Error("Claude response missing required fields (amount, vendor)");
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
