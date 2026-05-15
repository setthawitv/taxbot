import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;          // total paid
  vendor: string;          // payer/payee name
  date: string;            // YYYY-MM-DD
  description: string;     // short Thai description
  docType: string;         // slip type
  expenseCategory: string; // expense category
  quantity: number;
  unitPrice: number;
  vatAmount: number;
  withholdingTax: number;
  invoiceNo: string;
  invoiceName: string;
  taxId: string;
  branch: string;
  transactionId: string;   // bank Transaction ID printed on slip (e.g. "016132211009DPP00161")
};

/** Extract the first {...} JSON block from a string, even if there is surrounding text. */
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

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const today = new Date().toISOString().split("T")[0];
  let rawText = "";

  try {
    const response = await client.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
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
                "You are a Thai receipt/slip reader.",
                "Extract data from the image and reply with a single JSON object only — no explanation, no markdown, no extra text.",
                "",
                "Required JSON fields:",
                '- type: "income" or "expense"',
                "- amount: total paid as a number",
                "- vendor: the name of the RECIPIENT (who is receiving the money). For bank transfer slips, this is the DESTINATION account holder shown at the bottom of the arrow, NOT the sender at the top.",
                `- date: "YYYY-MM-DD" (use ${today} if not visible)`,
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
              ].join("\n"),
            },
          ],
        },
      ],
    });

    rawText = response.choices[0].message.content?.trim() ?? "";
    console.log("[groq] raw response:", rawText.slice(0, 300));
  } catch (apiErr) {
    console.error("[groq] API call failed:", apiErr);
    throw apiErr;
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
