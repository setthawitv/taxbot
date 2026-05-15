import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export type ReceiptData = {
  type: "income" | "expense";
  amount: number;
  vendor: string;
  date: string; // YYYY-MM-DD
  description: string;
};

export async function readReceipt(base64Image: string): Promise<ReceiptData> {
  const today = new Date().toISOString().split("T")[0];

  const response = await client.chat.completions.create({
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    max_tokens: 256,
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
            text: `You are a Thai receipt/slip reader for an online store accounting app.
Extract the following from the image:
- type: "income" or "expense"
- amount: number only (no symbols)
- vendor: store or recipient name
- date: YYYY-MM-DD format (use ${today} if not visible)
- description: short description in Thai

Reply with JSON only, no explanation, no markdown.
Example: {"type":"expense","amount":250,"vendor":"เซเว่น","date":"${today}","description":"ซื้อของใช้"}`,
          },
        ],
      },
    ],
  });

  const text = response.choices[0].message.content?.trim() ?? "";
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json) as ReceiptData;
}
