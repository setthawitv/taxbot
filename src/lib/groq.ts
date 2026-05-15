import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;          // total paid — ยอดชำระ (column M)
  vendor: string;          // ผู้รับ/ผู้ให้บริการ (column Q)
  date: string;            // YYYY-MM-DD
  description: string;     // short description (column G)
  docType: string;         // สลิปโอนเงิน | ใบเสร็จรับเงิน | ใบกำกับภาษี | อื่นๆ
  expenseCategory: string; // บุคลากร & ค่าจ้าง | สินค้า | บริการ | ค่าขนส่ง | ค่าเช่า | อื่นๆ
  quantity: number;        // จำนวน (default 1)
  unitPrice: number;       // ราคาต่อหน่วย
  vatAmount: number;       // ภาษีมูลค่าเพิ่ม (default 0)
  withholdingTax: number;  // ภาษีหัก ณ ที่จ่าย (default 0)
  invoiceNo: string;       // เลขที่ใบกำกับภาษี (blank if none)
  invoiceName: string;     // ชื่อในใบกำกับ ("ไม่มี" if none)
  taxId: string;           // เลขประจำตัวผู้เสียภาษี (blank if none)
  branch: string;          // สาขา (blank if none)
};

/** Extract the first {...} JSON block from a string, even if there's surrounding text. */
function extractJson(raw: string): string {
  // Strip markdown code fences
  const stripped = raw.replace(/```json|```/gi, "").trim();

  // Find the first { ... } block
  const start = stripped.indexOf("{");
  const end   = stripped.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return stripped.slice(start, end + 1);
  }
  return stripped;
}

/** Safe number coercion — keeps 0 as 0 (unlike `|| 0` which drops valid zeros) */
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
      max_tokens: 512,
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
              text: `You are a Thai receipt/slip reader. Extract data from the image and reply with a single JSON object only — no explanation, no markdown, no extra text.

Required JSON fields:
- type: "income" or "expense"
- amount: total paid as a number
- vendor: payer/payee name
- date: "YYYY-MM-DD" (use ${today} if not visible)
- description: short Thai description
- docType: "สลิปโอนเงิน" or "ใบเสร็จรับเงิน" or "ใบกำกับภาษี" or "อื่นๆ"
- expenseCategory: "บุคลากร & ค่าจ้าง" or "สินค้า" or "บริการ" or "ค่าขนส่ง" or "ค่าเช่า" or "อื่นๆ"
- quantity: number (default 1)
- unitPrice: number (default = amount)
- vatAmount: number (default 0)
- withholdingTax: number (default 0)
- invoiceNo: string (default "")
- invoiceName: string (default "ไม่มี")
- taxId: string (default "")
- branch: string (default "")

Example output:
{"type":"expense","amount":200,"vendor":"ร้านค้า","date":"${today}","description":"ค่าสินค้า","docType":"ใบเสร็จรับเงิน","expenseCategory":"สินค้า","quantity":1,"unitPrice":200,"vatAmount":0,"withholdingTax":0,"invoiceNo":"","invoiceName":"ไม่มี","taxId":"","branch":""}`,
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

  // Parse JSON with robust extraction
  let parsed: Partial<ReceiptData> = {};
  try {
    parsed = JSON.parse(extractJson(rawText));
  } catch (parseErr) {
    console.error("[groq] JSON parse failed. Raw text was:", rawText);
    throw new Error(`Failed to parse AI response: ${rawText.slice(0, 200)}`);
  }

  // Validate required fields
  if (!parsed.amount || !parsed.vendor) {
    console.error("[groq] Missing required fields in parsed result:", parsed);
    throw new Error("AI response missing required fields (amount, vendor)");
  }

  // Normalise and fill defaults
  return {
    type:             (parsed.type === "income" ? "income" : "expense"),
    amount:           safeNum(parsed.amount),
    vendor:           String(parsed.vendor ?? "ไม่ระบุ"),
    date:             String(parsed.date ?? today),
    description:      String(parsed.description ?? ""),
    docType:          String(parsed.docType ?? "อื่นๆ"),
    expenseCategory:  String(parsed.expenseCategory ?? "อื่นๆ"),
    quantity:         safeNum(parsed.quantity, 1) || 1,
    unitPrice:        safeNum(parsed.unitPrice) || safeNum(parsed.amount),
    vatAmount:        safeNum(parsed.vatAmount, 0),
    withholdingTax:   safeNum(parsed.withholdingTax, 0),
    invoiceNo:        String(parsed.invoiceNo ?? ""),
    invoiceName:      String(parsed.invoiceName ?? "ไม่มี"),
    taxId:            String(parsed.taxId ?? ""),
    branch:           String(parsed.branch ?? ""),
  };
}
