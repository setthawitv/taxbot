import Groq from "groq-sdk";
import { supabaseAdmin } from "@/lib/supabase";

// Chatbot runs on Groq for now (Anthropic key pending). To switch back to Claude:
// swap this client + CHAT_MODEL ids + the call in chat() back to the Anthropic SDK.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Plans that get the chatbot, their monthly message quota, and model ────────
export type ChatPlan = "pro" | "platinum";

export const CHAT_LIMITS: Record<ChatPlan, number> = {
  pro:      100,   // descriptive
  platinum: 200,   // predictive
};

const CHAT_MODEL: Record<ChatPlan, string> = {
  pro:      "meta-llama/llama-4-scout-17b-16e-instruct", // fast/cheap — descriptive
  platinum: "llama-3.3-70b-versatile",                   // stronger — predictive
};

const MAX_OUTPUT_TOKENS = 800;

// ── Thai personal income tax (หักเหมา 60%) — mirrors /api/tax/summary ──────────
const BRACKETS = [
  { max: 150_000, rate: 0 }, { max: 300_000, rate: 0.05 }, { max: 500_000, rate: 0.10 },
  { max: 750_000, rate: 0.15 }, { max: 1_000_000, rate: 0.20 }, { max: 2_000_000, rate: 0.25 },
  { max: 5_000_000, rate: 0.30 }, { max: Infinity, rate: 0.35 },
];
function estimateTax(income: number): number {
  const taxable = Math.max(0, income - income * 0.6 - 60_000);
  let remaining = taxable, tax = 0, prev = 0;
  for (const b of BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, b.max - prev);
    tax += slice * b.rate;
    remaining -= slice;
    prev = b.max;
  }
  return Math.round(tax);
}

const thb = (n: number) => "฿" + Math.round(n).toLocaleString("en-US");
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Build a compact Thai summary of the user's finances for the AI context.
 * We summarise (year + current month totals, platform split, top expense
 * vendors, tax estimate) rather than dumping raw rows — keeps input tokens low
 * and answers grounded.
 */
export async function buildUserContext(userId: string): Promise<string> {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;
  const yStart = `${year}-01-01`;
  const yEnd   = `${year}-12-31`;
  const mStart = `${year}-${pad(month)}-01`;
  const mEnd   = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`;

  const [{ data: orders }, { data: txns }] = await Promise.all([
    supabaseAdmin
      .from("platform_orders")
      .select("amount, platform, order_date")
      .eq("user_id", userId)
      .gte("order_date", yStart)
      .lte("order_date", yEnd),
    supabaseAdmin
      .from("transactions")
      .select("type, amount, vendor, transaction_date")
      .eq("user_id", userId)
      .gte("transaction_date", yStart)
      .lte("transaction_date", yEnd),
  ]);

  const O = orders ?? [];
  const T = txns ?? [];
  const inMonth = (d: string) => d >= mStart && d <= mEnd;

  // Income (platform orders + manual income transactions)
  const byPlatform: Record<string, number> = {};
  for (const o of O) byPlatform[o.platform] = (byPlatform[o.platform] ?? 0) + Number(o.amount);
  const platformIncomeY = O.reduce((s, o) => s + Number(o.amount), 0);
  const manualIncomeY   = T.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const incomeY = platformIncomeY + manualIncomeY;

  const incomeM =
    O.filter((o) => inMonth(o.order_date)).reduce((s, o) => s + Number(o.amount), 0) +
    T.filter((t) => t.type === "income" && inMonth(t.transaction_date)).reduce((s, t) => s + Number(t.amount), 0);

  // Expense (transactions type=expense)
  const expensesY = T.filter((t) => t.type === "expense");
  const expenseY  = expensesY.reduce((s, t) => s + Number(t.amount), 0);
  const expenseM  = expensesY.filter((t) => inMonth(t.transaction_date)).reduce((s, t) => s + Number(t.amount), 0);

  // Top expense vendors this year
  const byVendor: Record<string, number> = {};
  for (const t of expensesY) {
    const v = (t.vendor ?? "ไม่ระบุ").trim() || "ไม่ระบุ";
    byVendor[v] = (byVendor[v] ?? 0) + Number(t.amount);
  }
  const topVendors = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const platformLine = Object.entries(byPlatform)
    .map(([p, v]) => `${p}=${thb(v)}`).join(", ") || "ไม่มี";
  const vendorLines = topVendors.length
    ? topVendors.map(([v, amt], i) => `  ${i + 1}. ${v}: ${thb(amt)}`).join("\n")
    : "  (ยังไม่มีรายจ่ายบันทึก)";

  const tax = estimateTax(incomeY);

  return [
    `ข้อมูลการเงินของผู้ใช้ (อ้างอิงตัวเลขเหล่านี้เท่านั้น ห้ามแต่งเพิ่ม):`,
    `วันนี้: ${year}-${pad(month)}-${pad(now.getDate())}`,
    ``,
    `== ทั้งปี ${year} ==`,
    `รายรับรวม: ${thb(incomeY)} (จากแพลตฟอร์ม ${thb(platformIncomeY)}, manual ${thb(manualIncomeY)})`,
    `แยกแพลตฟอร์ม: ${platformLine}`,
    `รายจ่ายรวม: ${thb(expenseY)}`,
    `กำไรสุทธิ: ${thb(incomeY - expenseY)}`,
    `ภาษีโดยประมาณ (หักเหมา 60% + ลดหย่อนส่วนตัว 60,000): ${thb(tax)}`,
    incomeY >= 1_800_000 ? `⚠️ รายได้เกิน 1.8 ล้าน — ต้องจดทะเบียน VAT` : ``,
    ``,
    `== เดือนนี้ (${pad(month)}/${year}) ==`,
    `รายรับ: ${thb(incomeM)} | รายจ่าย: ${thb(expenseM)} | กำไร: ${thb(incomeM - expenseM)}`,
    ``,
    `รายจ่ายสูงสุดทั้งปี (top 5 ร้าน/ผู้รับเงิน):`,
    vendorLines,
  ].filter((l) => l !== "").join("\n");
}

const SYSTEM_DESCRIPTIVE = `คุณคือผู้ช่วยบัญชีอัจฉริยะของ Vendee สำหรับร้านค้าออนไลน์ไทย
หน้าที่: อธิบายและสรุปข้อมูลการเงินของผู้ใช้ให้เข้าใจง่าย ตอบคำถามว่า "เกิดอะไรขึ้น" กับตัวเลขของเขา
กฎ:
- ตอบเป็นภาษาไทย สั้น กระชับ เป็นกันเอง
- อ้างอิงเฉพาะตัวเลขจากข้อมูลที่ให้ ห้ามแต่งตัวเลขเอง ถ้าไม่มีข้อมูลให้บอกตรงๆ
- เน้นการบรรยาย/สรุป (descriptive) ไม่ต้องให้คำแนะนำเชิงกลยุทธ์ลึก
- จัดรูปแบบด้วย bullet หรือย่อหน้าสั้นๆ ให้อ่านง่าย`;

const SYSTEM_PREDICTIVE = `คุณคือที่ปรึกษาการเงิน-ภาษีอัจฉริยะของ Vendee สำหรับร้านค้าออนไลน์ไทย
หน้าที่: วิเคราะห์แนวโน้มและให้คำแนะนำเชิงรุก (predictive) — ผู้ใช้ "ควรทำอะไรต่อ"
กฎ:
- ตอบเป็นภาษาไทย กระชับ ชัดเจน ใช้ได้จริง
- อ้างอิงตัวเลขจริงจากข้อมูลที่ให้ ห้ามแต่งตัวเลขเอง
- ให้คำแนะนำที่ลงมือทำได้: วางแผนภาษี, ควรกันเงินเท่าไหร่, ลดรายจ่ายจุดไหน, เตือนเรื่อง VAT/กระแสเงินสด
- ถ้าเหมาะสม ให้ประมาณการตัวเลข (เช่น คาดการณ์รายได้/ภาษีสิ้นปี) พร้อมบอกสมมติฐาน
- ปิดท้ายด้วยขั้นตอนถัดไปที่แนะนำ 1-3 ข้อ`;

/** Send one chat turn to Claude. Pro→Haiku (descriptive), Platinum→Sonnet (predictive). */
export async function chat(opts: {
  plan: ChatPlan;
  context: string;
  history: { role: "user" | "assistant"; content: string }[];
  message: string;
}): Promise<{ reply: string; model: string }> {
  const model  = CHAT_MODEL[opts.plan];
  const system = opts.plan === "platinum" ? SYSTEM_PREDICTIVE : SYSTEM_DESCRIPTIVE;

  const response = await groq.chat.completions.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { role: "system" as const, content: `${system}\n\n${opts.context}` },
      ...opts.history,
      { role: "user" as const, content: opts.message },
    ],
  });

  const reply = response.choices[0]?.message?.content?.trim() ?? "";

  return { reply: reply || "ขออภัย ระบบยังตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้งนะคะ", model };
}
