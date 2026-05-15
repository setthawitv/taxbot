import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;
  vendor: string;
  date: string; // YYYY-MM-DD
  description: string;
};

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 256,
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
            text: `คุณคือผู้ช่วยอ่านใบเสร็จ/สลิปสำหรับร้านค้าออนไลน์ไทย
จากรูปภาพนี้ กรุณาดึงข้อมูลต่อไปนี้:
- type: "income" หรือ "expense" (รายรับ หรือ รายจ่าย)
- amount: จำนวนเงิน เป็นตัวเลข (ไม่มีสัญลักษณ์)
- vendor: ชื่อร้านค้า/ผู้รับเงิน
- date: วันที่ รูปแบบ YYYY-MM-DD (ถ้าไม่มีให้ใช้วันนี้)
- description: รายละเอียดสั้นๆ ภาษาไทย

ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบาย ไม่ต้องมี markdown
ตัวอย่าง: {"type":"expense","amount":250,"vendor":"เซเว่น","date":"2025-05-15","description":"ซื้อของใช้"}`,
          },
        ],
      },
    ],
  });

  const text = (response.content[0] as { type: string; text: string }).text.trim();
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json) as ReceiptData;
}
