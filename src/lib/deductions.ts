// Thai personal income tax deductions catalog (ปีภาษี 2567/2568)
// Source: กรมสรรพากร https://www.rd.go.th/43338.html

export type LimitType =
  | { kind: "fixed";    max: number }                                         // fixed THB cap
  | { kind: "perItem";  perItem: number; maxItems: number }                   // e.g. children 30k × N
  | { kind: "pctIncome"; pct: number; max: number }                           // % of income, capped
  | { kind: "pctNetIncome"; pct: number };                                    // % of net taxable income

export type DeductionItem = {
  id:         string;
  group:      "personal" | "insurance" | "donation" | "stimulus";
  label:      string;
  desc?:      string;
  limit:      LimitType;
  countLabel?: string;   // for perItem types, e.g. "คน"
  shareGroup?: string;   // items that share a combined cap, e.g. "life-insurance-100k"
  shareCap?:   number;
};

// ─── Share-cap rules ──────────────────────────────────────────────────────────
// Some deductions share a combined ceiling (e.g. life + health insurance ≤ 100k).
export const SHARE_CAPS: Record<string, number> = {
  "life_health_100k":   100_000,   // ประกันชีวิต + ประกันสุขภาพตนเอง
  "retire_500k":        500_000,   // RMF + PVD + กบข + ครู + ประกันบำนาญ
  "esg_300k":           300_000,   // Thai ESG
  "ssf_200k":           200_000,   // SSF
};

// ─── Catalog ──────────────────────────────────────────────────────────────────
export const DEDUCTIONS: DeductionItem[] = [
  // ── กลุ่ม 1: ภาระติดตัวและครอบครัว ────────────────────────────────────────
  { id: "personal",      group: "personal", label: "ค่าลดหย่อนส่วนตัว",
    desc: "ลดหย่อนอัตโนมัติทุกคน",
    limit: { kind: "fixed", max: 60_000 } },

  { id: "spouse",        group: "personal", label: "คู่สมรส (ไม่มีรายได้)",
    desc: "คู่สมรสตามกฎหมาย ที่ไม่มีรายได้",
    limit: { kind: "fixed", max: 60_000 } },

  { id: "children",      group: "personal", label: "บุตร",
    desc: "บุตรชอบด้วยกฎหมาย คนแรก 30,000 / คนที่ 2 เกิด 2561 ขึ้นไป 60,000",
    limit: { kind: "perItem", perItem: 30_000, maxItems: 10 },
    countLabel: "คน" },

  { id: "parents",       group: "personal", label: "อุปการะบิดามารดา",
    desc: "บิดา-มารดาอายุ ≥60 ปี รายได้ ≤30,000/ปี (สูงสุด 4 คน)",
    limit: { kind: "perItem", perItem: 30_000, maxItems: 4 },
    countLabel: "คน" },

  { id: "disabled",      group: "personal", label: "อุปการะผู้พิการ / ทุพพลภาพ",
    desc: "60,000/คน",
    limit: { kind: "perItem", perItem: 60_000, maxItems: 10 },
    countLabel: "คน" },

  { id: "prenatal",      group: "personal", label: "ค่าฝากครรภ์ / คลอดบุตร",
    desc: "สูงสุด 60,000 บาท/การตั้งครรภ์",
    limit: { kind: "fixed", max: 60_000 } },

  // ── กลุ่ม 2: ประกัน / เงินออม / การลงทุน ───────────────────────────────────
  { id: "life_insurance", group: "insurance", label: "ประกันชีวิต (ตนเอง)",
    desc: "เบี้ยประกันชีวิตทั่วไป กรมธรรม์ ≥10 ปี",
    limit: { kind: "fixed", max: 100_000 },
    shareGroup: "life_health_100k", shareCap: 100_000 },

  { id: "health_self",    group: "insurance", label: "ประกันสุขภาพ (ตนเอง)",
    desc: "สูงสุด 25,000 บาท (รวมกับประกันชีวิตไม่เกิน 100,000)",
    limit: { kind: "fixed", max: 25_000 },
    shareGroup: "life_health_100k", shareCap: 100_000 },

  { id: "health_parents", group: "insurance", label: "ประกันสุขภาพบิดามารดา",
    desc: "สูงสุด 15,000 บาท",
    limit: { kind: "fixed", max: 15_000 } },

  { id: "pension_insurance", group: "insurance", label: "ประกันชีวิตแบบบำนาญ",
    desc: "15% ของรายได้ ไม่เกิน 200,000 บาท",
    limit: { kind: "pctIncome", pct: 0.15, max: 200_000 },
    shareGroup: "retire_500k", shareCap: 500_000 },

  { id: "rmf",            group: "insurance", label: "กองทุนรวม RMF",
    desc: "30% ของรายได้ ไม่เกิน 500,000 บาท",
    limit: { kind: "pctIncome", pct: 0.30, max: 500_000 },
    shareGroup: "retire_500k", shareCap: 500_000 },

  { id: "ssf",            group: "insurance", label: "กองทุนรวม SSF",
    desc: "30% ของรายได้ ไม่เกิน 200,000 บาท",
    limit: { kind: "pctIncome", pct: 0.30, max: 200_000 },
    shareGroup: "ssf_200k", shareCap: 200_000 },

  { id: "thai_esg",       group: "insurance", label: "กองทุน Thai ESG",
    desc: "30% ของรายได้ ไม่เกิน 300,000 บาท",
    limit: { kind: "pctIncome", pct: 0.30, max: 300_000 } },

  { id: "pvd",            group: "insurance", label: "กองทุนสำรองเลี้ยงชีพ (PVD)",
    desc: "15% ของรายได้ ไม่เกิน 500,000",
    limit: { kind: "pctIncome", pct: 0.15, max: 500_000 },
    shareGroup: "retire_500k", shareCap: 500_000 },

  { id: "gpf",            group: "insurance", label: "กบข. / กสจ.",
    desc: "30% ของรายได้ ไม่เกิน 500,000",
    limit: { kind: "pctIncome", pct: 0.30, max: 500_000 },
    shareGroup: "retire_500k", shareCap: 500_000 },

  { id: "teacher_fund",   group: "insurance", label: "กองทุนสงเคราะห์ครูเอกชน",
    desc: "สูงสุด 500,000",
    limit: { kind: "fixed", max: 500_000 },
    shareGroup: "retire_500k", shareCap: 500_000 },

  { id: "ssa",            group: "insurance", label: "ประกันสังคม",
    desc: "เบี้ยที่จ่ายจริง สูงสุด 9,000 บาท/ปี",
    limit: { kind: "fixed", max: 9_000 } },

  { id: "home_loan",      group: "insurance", label: "ดอกเบี้ยซื้อบ้าน",
    desc: "ดอกเบี้ยกู้ยืมเพื่อที่อยู่อาศัย สูงสุด 100,000",
    limit: { kind: "fixed", max: 100_000 } },

  // ── กลุ่ม 3: เงินบริจาค ────────────────────────────────────────────────────
  { id: "donate_general", group: "donation", label: "เงินบริจาคทั่วไป",
    desc: "ไม่เกิน 10% ของเงินได้สุทธิหลังหักลดหย่อนอื่น",
    limit: { kind: "pctNetIncome", pct: 0.10 } },

  { id: "donate_edu",     group: "donation", label: "บริจาคการศึกษา / กีฬา / รพ.รัฐ (2 เท่า)",
    desc: "หักได้ 2 เท่า แต่รวมแล้วไม่เกิน 10% ของเงินได้สุทธิ",
    limit: { kind: "pctNetIncome", pct: 0.10 } },

  { id: "donate_party",   group: "donation", label: "บริจาคพรรคการเมือง",
    desc: "สูงสุด 10,000 บาท",
    limit: { kind: "fixed", max: 10_000 } },

  // ── กลุ่ม 4: มาตรการกระตุ้นเศรษฐกิจ (ปรับทุกปี) ────────────────────────────
  { id: "easy_ereceipt",  group: "stimulus", label: "Easy E-Receipt",
    desc: "ซื้อสินค้า/บริการที่มี e-Tax invoice สูงสุด 50,000",
    limit: { kind: "fixed", max: 50_000 } },

  { id: "travel_thailand", group: "stimulus", label: "เที่ยวดีมีคืน",
    desc: "ค่าที่พัก/แพ็กเกจทัวร์ในประเทศ สูงสุด 20,000 บาท · เมืองรอง 1.5 เท่า / เมืองหลัก 1 เท่า · 10,000 แรกใช้ใบกำกับกระดาษ/e-Tax · 10,000 หลัง e-Tax เท่านั้น · 29 ต.ค.–15 ธ.ค. 68",
    limit: { kind: "fixed", max: 20_000 } },
];

export const GROUP_LABELS: Record<DeductionItem["group"], string> = {
  personal:  "ภาระติดตัว / ครอบครัว",
  insurance: "ประกัน / เงินออม / การลงทุน",
  donation:  "เงินบริจาค",
  stimulus:  "มาตรการกระตุ้นเศรษฐกิจ",
};

// ─── Compute max allowed for one item given user context ──────────────────────
export function maxAllowed(item: DeductionItem, income: number, netIncomeBeforeDonation = 0): number {
  switch (item.limit.kind) {
    case "fixed":         return item.limit.max;
    case "perItem":       return item.limit.perItem * item.limit.maxItems;
    case "pctIncome":     return Math.min(income * item.limit.pct, item.limit.max);
    case "pctNetIncome":  return netIncomeBeforeDonation * item.limit.pct;
  }
}

// ─── Apply share-cap constraints across linked items ──────────────────────────
// Returns a map of {itemId → applied amount} (clamped to share caps)
export function applyShareCaps(
  selected: Record<string, number>
): Record<string, number> {
  const result = { ...selected };

  // group items by shareGroup
  const groups: Record<string, string[]> = {};
  for (const item of DEDUCTIONS) {
    if (item.shareGroup) {
      (groups[item.shareGroup] ??= []).push(item.id);
    }
  }

  for (const [groupId, ids] of Object.entries(groups)) {
    const cap = SHARE_CAPS[groupId];
    if (!cap) continue;
    let total = ids.reduce((s, id) => s + (result[id] ?? 0), 0);
    if (total <= cap) continue;
    // Proportionally scale down each item to fit cap
    const factor = cap / total;
    for (const id of ids) {
      if (result[id]) result[id] = Math.floor(result[id] * factor);
    }
  }
  return result;
}

// ─── Total deductions ─────────────────────────────────────────────────────────
export function sumDeductions(
  selected: Record<string, number>,
  income: number
): { totalNonDonation: number; totalDonation: number; capped: Record<string, number> } {
  const capped = applyShareCaps(selected);

  let totalNonDonation = 0;
  for (const item of DEDUCTIONS) {
    if (item.group === "donation") continue;
    const amt = capped[item.id] ?? 0;
    const max = maxAllowed(item, income);
    totalNonDonation += Math.min(amt, max);
  }

  // Donations: capped at % of net income BEFORE donations
  // (we'll compute this against income - non-donation deductions)
  let totalDonation = 0;
  for (const item of DEDUCTIONS) {
    if (item.group !== "donation") continue;
    const amt = capped[item.id] ?? 0;
    if (item.limit.kind === "pctNetIncome") {
      const netBefore = Math.max(0, income - totalNonDonation);
      const max = netBefore * item.limit.pct;
      totalDonation += Math.min(amt, max);
    } else if (item.limit.kind === "fixed") {
      totalDonation += Math.min(amt, item.limit.max);
    }
  }

  return { totalNonDonation, totalDonation, capped };
}
