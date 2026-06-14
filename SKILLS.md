# SKILLS.md — Coding Patterns & Rules for Vendee

## 1. LINE Webhook Handler Pattern

Always verify LINE signature. Every webhook must follow this pattern:

```typescript
// src/app/api/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as line from "@line/bot-sdk";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") || "";

  // Always verify signature first
  if (!line.validateSignature(body, config.channelSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const events = JSON.parse(body).events;

  await Promise.all(events.map(handleEvent));

  return NextResponse.json({ status: "ok" });
}

async function handleEvent(event: line.WebhookEvent) {
  if (event.type === "message" && event.source.userId) {
    const userId = event.source.userId;
    const replyToken = event.replyToken;

    if (event.message.type === "text") {
      await handleTextMessage(userId, replyToken, event.message.text);
    } else if (event.message.type === "image") {
      await handleImageMessage(userId, replyToken, event.message.id);
    }
  }
}
```

---

## 2. LINE Reply Message Patterns

### Simple text reply (Thai)
```typescript
await client.replyMessage({
  replyToken,
  messages: [{ type: "text", text: "ข้อความของคุณ" }],
});
```

### Flex Message (card UI in LINE chat)
```typescript
await client.replyMessage({
  replyToken,
  messages: [{
    type: "flex",
    altText: "สรุปยอดเดือนนี้",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "สรุปยอดเดือนนี้", weight: "bold", size: "lg" },
          { type: "text", text: `รายรับ: ฿${income.toLocaleString()}`, color: "#00B900" },
          { type: "text", text: `รายจ่าย: ฿${expense.toLocaleString()}`, color: "#FF0000" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [{
          type: "button",
          action: {
            type: "uri",
            label: "ดูรายละเอียด",
            uri: `${process.env.NEXT_PUBLIC_APP_URL}/liff/dashboard`,
          },
          style: "primary",
          color: "#00B900",
        }],
      },
    },
  }],
});
```

---

## 3. LIFF (LINE Mini App) Pattern

Every LIFF page must initialize and check login:

```typescript
"use client";
import { useEffect, useState } from "react";
import liff from "@line/liff";

export default function LiffPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const profile = await liff.getProfile();
        setUserId(profile.userId);
      } catch (err) {
        console.error("LIFF init error:", err);
      } finally {
        setLoading(false);
      }
    };
    initLiff();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">
    <p className="text-gray-500">กำลังโหลด...</p>
  </div>;

  if (!userId) return null;

  return <div>{/* your page content */}</div>;
}
```

---

## 4. Claude API — Receipt Reading Pattern

```typescript
// src/lib/claude.ts
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export interface ReceiptData {
  amount: number;
  date: string;
  type: "income" | "expense";
  description: string;
  category: string;
}

export async function readReceiptFromImage(imageBuffer: Buffer, mimeType: string): Promise<ReceiptData | null> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png",
              data: imageBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: `คุณคือผู้ช่วยอ่านใบเสร็จ/สลิปสำหรับร้านค้าออนไลน์ไทย
จากรูปภาพนี้ กรุณาดึงข้อมูลต่อไปนี้และตอบเป็น JSON เท่านั้น:
{
  "amount": จำนวนเงินเป็นตัวเลข,
  "date": "YYYY-MM-DD",
  "type": "income" หรือ "expense",
  "description": "รายละเอียดสั้นๆ",
  "category": "ค่าขนส่ง" หรือ "ค่าสินค้า" หรือ "รายได้จากการขาย" หรือ "ค่าแพลตฟอร์ม" หรือ "อื่นๆ"
}
ไม่ต้องมีคำอธิบาย ตอบ JSON เท่านั้น`,
          },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean) as ReceiptData;
  } catch (err) {
    console.error("Claude receipt read error:", err);
    return null;
  }
}

export async function explainTaxInThai(income: number, expense: number, estimatedTax: number): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `อธิบายภาษีนี้ให้เข้าใจง่ายสำหรับเจ้าของร้านค้าออนไลน์ที่ไม่รู้เรื่องบัญชี:
รายรับ: ${income.toLocaleString()} บาท
รายจ่าย: ${expense.toLocaleString()} บาท
ภาษีที่ควรจ่าย: ${estimatedTax.toLocaleString()} บาท
อธิบายสั้นๆ 3-4 ประโยค ภาษาไทยเข้าใจง่าย ไม่ใช้ศัพท์บัญชี`,
      }],
    });

    return response.content[0].type === "text" ? response.content[0].text : "ไม่สามารถอธิบายได้ในขณะนี้";
  } catch (err) {
    console.error("Claude tax explain error:", err);
    return "ไม่สามารถอธิบายได้ในขณะนี้";
  }
}
```

---

## 5. Supabase Client Pattern

```typescript
// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

// Client-side (LIFF pages)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side (API routes) — has full access
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

---

## 6. Tax Calculation Logic

```typescript
// src/lib/tax.ts

export function calculateThaiPersonalIncomeTax(netIncome: number): number {
  // Net income = total income - 60% expense deduction - 60,000 personal allowance
  const expenseDeduction = Math.min(netIncome * 0.6, 600000);
  const personalAllowance = 60000;
  const taxableIncome = Math.max(0, netIncome - expenseDeduction - personalAllowance);

  // Progressive tax brackets
  const brackets = [
    { min: 0, max: 150000, rate: 0 },
    { min: 150000, max: 300000, rate: 0.05 },
    { min: 300000, max: 500000, rate: 0.10 },
    { min: 500000, max: 750000, rate: 0.15 },
    { min: 750000, max: 1000000, rate: 0.20 },
    { min: 1000000, max: 2000000, rate: 0.25 },
    { min: 2000000, max: 5000000, rate: 0.30 },
    { min: 5000000, max: Infinity, rate: 0.35 },
  ];

  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }

  return Math.round(tax);
}

export function getVatWarning(annualIncome: number): string | null {
  if (annualIncome >= 1800000) {
    return "รายได้ของคุณเกิน 1.8 ล้านบาท ควรปรึกษานักบัญชีเรื่องการจด VAT";
  }
  if (annualIncome >= 1500000) {
    return "รายได้ใกล้ถึง 1.8 ล้านบาท ควรเริ่มวางแผนเรื่อง VAT";
  }
  return null;
}
```

---

## 7. UI Component Rules (Thai LIFF Pages)

- Use **Tailwind CSS** only, no external UI libraries
- Primary color: `#00B900` (LINE green)
- All labels, buttons, messages in **Thai**
- Mobile-first: max-width 390px, full height
- Loading state: always show `กำลังโหลด...`
- Error state: always show `เกิดข้อผิดพลาด กรุณาลองใหม่`
- Numbers: always use `.toLocaleString("th-TH")` for Thai number formatting
- Dates: display as Thai format `dd/mm/yyyy`

### Standard page wrapper:
```tsx
<div className="min-h-screen bg-gray-50 max-w-sm mx-auto">
  <header className="bg-[#00B900] text-white p-4 text-center font-bold text-lg">
    หัวข้อหน้า
  </header>
  <main className="p-4 space-y-4">
    {/* content */}
  </main>
</div>
```

---

## 8. Error Handling Rules

- All API routes must return consistent JSON: `{ data, error }`
- All Claude API calls wrapped in try/catch with Thai fallback message
- All Supabase calls check for error: `const { data, error } = await supabase...`
- LINE webhook must always return 200 even if internal error occurs (or LINE will retry)

```typescript
// API route standard response pattern
return NextResponse.json({ data: result, error: null }, { status: 200 });
return NextResponse.json({ data: null, error: "เกิดข้อผิดพลาด" }, { status: 500 });
```

---

## 9. File Naming Conventions

```
API routes:       src/app/api/[name]/route.ts
LIFF pages:       src/app/liff/[name]/page.tsx
Lib utilities:    src/lib/[name].ts
Types:            src/types/index.ts
```

---

## 10. Never Do These

- ❌ Never commit `.env.local`
- ❌ Never log API keys or LINE user IDs to console in production
- ❌ Never skip LINE signature verification
- ❌ Never call Claude API without try/catch
- ❌ Never display English text to users (Thai only)
- ❌ Never use `any` TypeScript type without a comment explaining why
