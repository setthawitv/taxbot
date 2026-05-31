// Shared Thai tax calculation library — works both server & client.
// Source: กรมสรรพากร https://www.rd.go.th/43338.html (ปีภาษี 2567/2024 — มีผลต่อเนื่อง)

// ─── Personal income tax brackets ─────────────────────────────────────────────
export const PIT_BRACKETS = [
  { min: 0,         max: 150_000,     rate: 0.00 },
  { min: 150_000,   max: 300_000,     rate: 0.05 },
  { min: 300_000,   max: 500_000,     rate: 0.10 },
  { min: 500_000,   max: 750_000,     rate: 0.15 },
  { min: 750_000,   max: 1_000_000,   rate: 0.20 },
  { min: 1_000_000, max: 2_000_000,   rate: 0.25 },
  { min: 2_000_000, max: 5_000_000,   rate: 0.30 },
  { min: 5_000_000, max: Infinity,    rate: 0.35 },
];

export type Breakdown = { rate: number; amount: number; tax: number };

export function calcPIT(taxable: number): { tax: number; breakdown: Breakdown[] } {
  if (taxable <= 0) return { tax: 0, breakdown: [] };
  let remaining = taxable;
  let totalTax = 0;
  const breakdown: Breakdown[] = [];
  for (const b of PIT_BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, b.max - b.min);
    const tax   = slice * b.rate;
    if (b.rate > 0) breakdown.push({ rate: b.rate, amount: slice, tax });
    totalTax  += tax;
    remaining -= slice;
  }
  return { tax: totalTax, breakdown };
}

// ─── Corporate income tax (CIT) ───────────────────────────────────────────────
// SMEs (paid-up capital ≤ 5M + revenue ≤ 30M):
//   ≤ 300,000      → 0%
//   300,001-3M     → 15%
//   > 3M           → 20%
// Regular companies: flat 20%
export function calcCIT(netProfit: number, isSME: boolean): { tax: number; breakdown: Breakdown[] } {
  if (netProfit <= 0) return { tax: 0, breakdown: [] };
  if (!isSME) {
    const tax = netProfit * 0.20;
    return { tax, breakdown: [{ rate: 0.20, amount: netProfit, tax }] };
  }
  const tiers = [
    { min: 0,         max: 300_000,   rate: 0.00 },
    { min: 300_000,   max: 3_000_000, rate: 0.15 },
    { min: 3_000_000, max: Infinity,  rate: 0.20 },
  ];
  let remaining = netProfit, totalTax = 0;
  const breakdown: Breakdown[] = [];
  for (const t of tiers) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, t.max - t.min);
    const tax   = slice * t.rate;
    if (t.rate > 0) breakdown.push({ rate: t.rate, amount: slice, tax });
    totalTax  += tax;
    remaining -= slice;
  }
  return { tax: totalTax, breakdown };
}
