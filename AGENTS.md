# AGENTS.md — Vendee Project Guide for Claude Code

## Project Overview
Vendee is a LINE OA-based web app for Thai SME owners and ecommerce sellers (Shopee, TikTok, Lazada).
Users interact via:
- **LINE Chatbot** — send receipt photos, ask quick balance questions, get tax reminders
- **LINE Mini App (LIFF)** — full dashboard, transaction history, tax summary

The core value: zero accounting knowledge needed. Upload a slip → AI reads it → tax calculated automatically. Thai UI throughout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| LINE Chatbot | @line/bot-sdk (Messaging API) |
| LINE Mini App | LIFF SDK (LINE Frontend Framework) |
| Database | Supabase (PostgreSQL) |
| Auth | LINE Login via LIFF (no separate auth needed) |
| AI | Claude API (claude-sonnet-4-20250514) — receipt OCR + tax explanation |
| Hosting | Vercel |
| Language | Thai UI, English code/comments |

---

## Project Structure

```
vendee/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── webhook/route.ts        # LINE Messaging API webhook
│   │   │   ├── transactions/route.ts   # CRUD for income/expense records
│   │   │   └── tax/route.ts            # Tax calculation endpoint
│   │   ├── liff/
│   │   │   ├── page.tsx                # LIFF Mini App entry point
│   │   │   ├── dashboard/page.tsx      # Income/expense summary
│   │   │   ├── add/page.tsx            # Manual transaction entry
│   │   │   ├── history/page.tsx        # Transaction history list
│   │   │   └── tax/page.tsx            # Tax estimate summary
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── line.ts                     # LINE client + message helpers
│   │   ├── supabase.ts                 # Supabase client
│   │   ├── claude.ts                   # Claude API calls (receipt reading, tax explanation)
│   │   └── tax.ts                      # Thai tax calculation logic
│   └── types/
│       └── index.ts                    # Shared TypeScript types
├── .env.local                          # Secret keys (never commit)
├── AGENTS.md                           # This file
└── SKILLS.md                           # Coding patterns and rules
```

---

## Environment Variables

```bash
# LINE
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_LIFF_ID=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=
```

---

## Database Schema (Supabase)

```sql
-- Users (identified by LINE user ID)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  picture_url TEXT,
  business_type TEXT CHECK (business_type IN ('informal', 'sole_proprietor', 'company')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('income', 'expense')),
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT,
  description TEXT,
  source TEXT, -- 'shopee', 'tiktok', 'manual', 'slip_photo'
  slip_image_url TEXT,
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Summaries (cached calculations)
CREATE TABLE tax_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT,
  total_income NUMERIC(12, 2),
  total_expense NUMERIC(12, 2),
  estimated_tax NUMERIC(12, 2),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Business Logic

### Thai Personal Income Tax Brackets (2025)
```
0 - 150,000 THB        → 0%
150,001 - 300,000 THB  → 5%
300,001 - 500,000 THB  → 10%
500,001 - 750,000 THB  → 15%
750,001 - 1,000,000 THB → 20%
1,000,001 - 2,000,000 THB → 25%
2,000,001 - 5,000,000 THB → 30%
5,000,001+ THB         → 35%
```

### Standard Deductions for Ecommerce Sellers
- Business expense deduction: 60% of income (capped at 600,000 THB) for sole proprietors
- Personal allowance: 60,000 THB
- VAT threshold: 1,800,000 THB/year (must register if exceeded)

### Chatbot Commands to Handle
| User says | Bot does |
|---|---|
| Sends photo | Extract slip data via Claude API, save transaction |
| "ยอดเดือนนี้" | Reply with current month income/expense summary |
| "ภาษี" | Reply with estimated tax + link to LIFF tax page |
| "บันทึกรายรับ" | Guide to LIFF add transaction page |
| anything else | Reply with menu of available commands |

---

## Claude API Usage Pattern

```typescript
// Always use this model
const MODEL = "claude-sonnet-4-20250514";

// Receipt reading prompt (Thai)
const RECEIPT_PROMPT = `
คุณคือผู้ช่วยอ่านใบเสร็จ/สลิปสำหรับร้านค้าออนไลน์ไทย
จากรูปภาพนี้ กรุณาดึงข้อมูลต่อไปนี้:
- จำนวนเงิน (amount) เป็นตัวเลข
- วันที่ (date) รูปแบบ YYYY-MM-DD
- ประเภท (type): income หรือ expense
- รายละเอียด (description) สั้นๆ ภาษาไทย
- หมวดหมู่ (category): ค่าขนส่ง / ค่าสินค้า / รายได้จากการขาย / ค่าแพลตฟอร์ม / อื่นๆ

ตอบเป็น JSON เท่านั้น ไม่ต้องมีคำอธิบาย
`;
```

---

## Coding Rules (see SKILLS.md for details)
- All user-facing text must be in **Thai**
- All code, comments, variable names in **English**
- Always handle LINE webhook signature verification
- Never log or expose API keys
- All Claude API calls must have try/catch
- LIFF pages must check `liff.isLoggedIn()` before rendering
