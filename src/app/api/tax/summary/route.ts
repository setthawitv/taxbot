import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Thai personal income tax brackets 2025
const BRACKETS = [
  { min: 0,         max: 150_000,     rate: 0.00 },
  { min: 150_000,   max: 300_000,     rate: 0.05 },
  { min: 300_000,   max: 500_000,     rate: 0.10 },
  { min: 500_000,   max: 750_000,     rate: 0.15 },
  { min: 750_000,   max: 1_000_000,   rate: 0.20 },
  { min: 1_000_000, max: 2_000_000,   rate: 0.25 },
  { min: 2_000_000, max: 5_000_000,   rate: 0.30 },
  { min: 5_000_000, max: Infinity,    rate: 0.35 },
];

function calcTax(taxable: number): { tax: number; breakdown: { rate: number; amount: number; tax: number }[] } {
  if (taxable <= 0) return { tax: 0, breakdown: [] };

  let remaining = taxable;
  let totalTax  = 0;
  const breakdown: { rate: number; amount: number; tax: number }[] = [];

  for (const b of BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, b.max - b.min);
    const tax   = slice * b.rate;
    if (b.rate > 0) breakdown.push({ rate: b.rate, amount: slice, tax });
    totalTax  += tax;
    remaining -= slice;
  }

  return { tax: totalTax, breakdown };
}

// GET /api/tax/summary?lineUserId=xxx&year=2026
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId     = searchParams.get("userId") ?? searchParams.get("lineUserId");
  const year       = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, business_type")
    .eq("id", userId)
    .single();

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const dateFrom = `${year}-01-01`;
  const dateTo   = `${year}-12-31`;

  // ── Fetch income from platform_orders ──────────────────────────────────────
  const { data: platformOrders } = await supabaseAdmin
    .from("platform_orders")
    .select("amount, platform")
    .eq("user_id", user.id)
    .gte("order_date", dateFrom)
    .lte("order_date", dateTo);

  const platformIncome = (platformOrders ?? []).reduce((s, r) => s + Number(r.amount), 0);

  // Break down by platform
  const byPlatform: Record<string, number> = {};
  for (const r of platformOrders ?? []) {
    byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + Number(r.amount);
  }

  // ── Fetch income/expense from transactions ──────────────────────────────────
  const { data: txns } = await supabaseAdmin
    .from("transactions")
    .select("type, amount")
    .eq("user_id", user.id)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  const manualIncome = (txns ?? []).filter((t) => t.type === "income") .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = (txns ?? []).filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalIncome       = platformIncome + manualIncome;
  const personalAllowance = 60_000;

  // ── Method 1: Standard deduction (หักเหมา 60%, max 600,000 THB) ────────────
  // มาตรา 40(8) หักเหมา 60% ไม่มีเพดาน (กฎปัจจุบัน ตั้งแต่ปี 2563)
  const standardDeduction = totalIncome * 0.6;
  const totalDeductions1  = standardDeduction + personalAllowance;
  const taxableIncome1    = Math.max(totalIncome - totalDeductions1, 0);
  const { tax: tax1, breakdown: breakdown1 } = calcTax(taxableIncome1);

  // ── Method 2: Actual expenses (หักตามจริง) ──────────────────────────────────
  // Uses recorded expenses from transactions table (type = 'expense')
  const totalDeductions2  = totalExpense + personalAllowance;
  const taxableIncome2    = Math.max(totalIncome - totalDeductions2, 0);
  const { tax: tax2, breakdown: breakdown2 } = calcTax(taxableIncome2);

  // ── Recommended method (lower tax = better) ─────────────────────────────────
  const recommended = tax1 <= tax2 ? 1 : 2;

  return NextResponse.json({
    year,
    totalIncome,
    platformIncome,
    manualIncome,
    totalExpense,
    byPlatform,
    personalAllowance,
    method1: {
      label:             "หักเหมา 60%",
      standardDeduction,
      totalDeductions:   totalDeductions1,
      taxableIncome:     taxableIncome1,
      estimatedTax:      tax1,
      breakdown:         breakdown1,
    },
    method2: {
      label:           "หักตามจริง",
      actualExpense:   totalExpense,
      totalDeductions: totalDeductions2,
      taxableIncome:   taxableIncome2,
      estimatedTax:    tax2,
      breakdown:       breakdown2,
    },
    recommended,
    savings: Math.abs(tax1 - tax2),
    vatWarning: totalIncome >= 1_800_000,
  });
}
