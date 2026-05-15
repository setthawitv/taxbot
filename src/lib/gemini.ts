import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;
  vendor: string;
  date: string; // YYYY-MM-DD
  description: string;
};

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `คุณคือผู้ช่วยอ่านใบเสร็จ/สลิปสำหรับร้านค้าออนไลน์ไทย
จากรูปภาพนี้ กรุณาดึงข้อมูลต่อไปนี้:
- type: "income" หรือ "expense" (รายรับ หรือ รายจ่าย)
- amount: จำนวนเงิน เป็นตัวเลข (ไม่มีสัญลักษณ์)
- vendor: ชื่อร้านค้า/ผู้รับเงิน
- date: วันที่ รูปแบบ YYYY-MM-DD (ถ้าไม่มีให้ใช้วันนี้)
- description: รายละเอียดสั้นๆ ภาษาไทย

ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบาย ไม่ต้องมี markdown
ตัวอย่าง: {"type":"expense","amount":250,"vendor":"เซเว่น","date":"2025-05-15","description":"ซื้อของใช้"}`;

  const result = await model.generateContent([
    { inlineData: { mimeType: "image/jpeg", data: base64Image } },
    prompt,
  ]);

  const text = result.response.text().trim();
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json) as ReceiptData;
}
