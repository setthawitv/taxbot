"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import {
  VendeeLogo,
  IconScan, IconIncome, IconTax, IconGoogleSheets, IconUpload, IconShield,
  IconSparkle, IconRocket, IconFire, IconCrown,
  IconCheck, IconX, IconArrowDown, IconArrowRight,
} from "@/components/icons";
import { calcPIT, calcCIT } from "@/lib/tax-calc";
import { DEDUCTIONS, GROUP_LABELS, maxAllowed, sumDeductions, type DeductionItem } from "@/lib/deductions";
import { useEffect } from "react";
import { lsGet, lsSet } from "@/lib/storage";

type IconC = ComponentType<{ className?: string }>;

// ── Segment fields collected from free visitors before showing the tax result ──
const AGE_OPTIONS        = ["ต่ำกว่า 20", "20–29", "30–39", "40–49", "50 ปีขึ้นไป"];
const OCCUPATION_OPTIONS = ["พ่อค้าแม่ค้าออนไลน์", "พนักงานประจำ", "ธุรกิจส่วนตัว", "ฟรีแลนซ์", "นักศึกษา", "อื่นๆ"];
const CHANNEL_OPTIONS    = ["Shopee", "TikTok", "Lazada", "หน้าร้านตัวเอง", "ยังไม่ได้ขาย", "อื่นๆ"];
const INCOME_OPTIONS     = ["น้อยกว่า 50,000", "50,000–100,000", "100,000–300,000", "มากกว่า 300,000"];

const SEGMENT_FIELDS = [
  { key: "age_range",     label: "อายุ",            options: AGE_OPTIONS },
  { key: "occupation",    label: "อาชีพ",           options: OCCUPATION_OPTIONS },
  { key: "sales_channel", label: "ช่องทางขายหลัก",  options: CHANNEL_OPTIONS },
  { key: "income_range",  label: "รายได้ต่อเดือน",  options: INCOME_OPTIONS },
] as const;

const FEATURES: { slug: string; Icon: IconC; title: string; desc: string; color: string; iconColor: string; chipBg: string }[] = [
  { slug: "scan",           Icon: IconScan,          title: "สแกนใบเสร็จด้วย AI",
    desc: "ถ่ายรูปสลิปหรืออัปโหลดใบเสร็จ AI อ่านยอด วันที่ ร้านค้า และบันทึกให้อัตโนมัติ",
    color: "from-purple-50 to-white border-purple-100",
    iconColor: "text-purple-600",
    chipBg: "bg-purple-100" },
  { slug: "income-expense", Icon: IconIncome,        title: "ติดตามรายรับ-รายจ่าย",
    desc: "ดูยอดเดือนนี้ ทั้งปี กำไร-ขาดทุน พร้อมแยกแพลตฟอร์ม TikTok / Shopee / Lazada",
    color: "from-emerald-50 to-white border-emerald-100",
    iconColor: "text-emerald-600",
    chipBg: "bg-emerald-100" },
  { slug: "tax",            Icon: IconTax,           title: "คำนวณภาษีอัตโนมัติ",
    desc: "ประมาณภาษีเงินได้บุคคลธรรมดา ตามอัตราของไทย พร้อมแนะนำวิธีหักค่าใช้จ่าย",
    color: "from-blue-50 to-white border-blue-100",
    iconColor: "text-blue-600",
    chipBg: "bg-blue-100" },
  { slug: "sheets",         Icon: IconGoogleSheets,  title: "ซิงค์ Google Sheets",
    desc: "ทุกรายการบันทึกลง Google Sheets ของคุณอัตโนมัติ ดาวน์โหลดหรือแชร์กับนักบัญชีได้ทันที",
    color: "from-green-50 to-white border-green-100",
    iconColor: "text-green-600",
    chipBg: "bg-green-100" },
  { slug: "import",         Icon: IconUpload,        title: "นำเข้ายอดแพลตฟอร์ม",
    desc: "อัปโหลดไฟล์ Excel จาก TikTok Shop, Shopee, Lazada — ระบบแยกยอดให้อัตโนมัติ",
    color: "from-orange-50 to-white border-orange-100",
    iconColor: "text-orange-600",
    chipBg: "bg-orange-100" },
  { slug: "team",           Icon: IconShield,        title: "แชร์ให้ทีมงาน",
    desc: "เพิ่ม Admin ด้วย Google Email หรือสร้างลิงก์ Staff ให้พนักงานบันทึกรายจ่ายแทนได้",
    color: "from-rose-50 to-white border-rose-100",
    iconColor: "text-rose-600",
    chipBg: "bg-rose-100" },
];

const PLANS: {
  name: string; planKey: string | null; price: string; period: string;
  badge: { Icon: IconC; label: string } | null;
  color: string; btnClass: string;
  features: string[]; disabled: number[];
}[] = [
  { name: "Free", planKey: null, price: "ฟรี", period: "", badge: null,
    color: "border-gray-200 bg-white",
    btnClass: "bg-gray-100 hover:bg-gray-200 text-gray-800",
    features: [
      "ทดลองใช้ฟรี 7 วัน (ทุกฟีเจอร์)",
      "รายจ่าย 10 รายการ/เดือน",
      "รายรับ Manual เท่านั้น",
      "ไม่รองรับ Excel import",
      "Google Sheets sync",
    ],
    disabled: [2, 3] },
  { name: "Eco", planKey: "eco", price: "฿100", period: "/เดือน", badge: null,
    color: "border-blue-200 bg-blue-50/40",
    btnClass: "bg-blue-500 hover:bg-blue-400 text-white",
    features: [
      "รายจ่าย 30 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 1 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] },
  { name: "Pro", planKey: "pro", price: "฿200", period: "/เดือน",
    badge: { Icon: IconFire, label: "แนะนำ" },
    color: "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/30",
    btnClass: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25",
    features: [
      "รายจ่าย 100 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 5 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] },
  { name: "Platinum", planKey: "platinum", price: "฿700", period: "/เดือน",
    badge: { Icon: IconCrown, label: "ครบทุกอย่าง" },
    color: "border-amber-200 bg-amber-50/40",
    btnClass: "bg-amber-500 hover:bg-amber-400 text-white",
    features: [
      "รายจ่าย 1,200 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 12 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] },
];

const STEPS = [
  { no: "01", title: "เข้าสู่ระบบ",         desc: "สมัครฟรี ไม่ต้องดาวน์โหลดแอป ไม่ต้องจำรหัสผ่านใหม่" },
  { no: "02", title: "เชื่อม Google Drive", desc: "เชื่อมต่อ Google เพื่อเก็บข้อมูลและซิงค์ Sheets อัตโนมัติ" },
  { no: "03", title: "เริ่มบันทึกได้เลย",   desc: "สแกนใบเสร็จ บันทึกรายรับ-รายจ่าย ดูรายงาน — ทำได้ทันที" },
];

// ─── Public Tax Calculator ──────────────────────────────────────────────────
const fmtInt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmt2   = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format for number input display (with thousand separator)
const formatInput = (n: number) => n > 0 ? n.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "";
// Parse user input — strip commas and non-digits, then convert
const parseInput = (s: string) => {
  const digits = s.replace(/[^\d.]/g, "");
  return parseFloat(digits) || 0;
};

// Light-themed deduction row for landing page
function DeductionRow({
  item, value, onChange, income,
}: {
  item: DeductionItem;
  value: number;
  onChange: (v: number) => void;
  income: number;
}) {
  const max  = maxAllowed(item, income);
  const used = Math.min(value, max);
  const pct  = max > 0 ? Math.min(100, (used / max) * 100) : 0;

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{item.label}</p>
          {item.desc && <p className="text-xs text-gray-500 mt-0.5 leading-tight">{item.desc}</p>}
        </div>
        <span className="text-xs text-gray-500 flex-shrink-0 font-medium whitespace-nowrap">
          สูงสุด ฿{fmtInt(max)}
        </span>
      </div>

      <div className="flex items-center bg-white rounded-lg border border-gray-200 focus-within:border-blue-400">
        <span className="text-gray-400 px-2 text-sm">฿</span>
        <input type="text" inputMode="decimal"
          value={formatInput(value)}
          onChange={(e) => onChange(Math.min(max, Math.max(0, parseInput(e.target.value))))}
          placeholder="0"
          className="flex-1 bg-transparent py-2 px-1 text-sm text-gray-900 outline-none placeholder-gray-400" />
        <button type="button" onClick={() => onChange(max)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-500 px-2 py-1">
          Max
        </button>
      </div>

      <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

type IncomeMode = "salary" | "business" | "both";

function PublicTaxCalculator() {
  const [taxpayer, setTaxpayer]   = useState<"individual" | "corporate">("individual");
  const [incomeMode, setIncomeMode] = useState<IncomeMode>("business");
  const [isSME,    setIsSME]      = useState(true);
  const [income,   setIncome]     = useState(600_000);
  const [salary,   setSalary]     = useState(0);
  const [method,   setMethod]     = useState<"flat60" | "actual">("flat60");
  const [expense,  setExpense]    = useState(0);
  const [deductions, setDeductions] = useState<Record<string, number>>({ personal: 60_000 });
  const [showDeductions, setShowDeductions] = useState(false);

  // Segment gate: visitor must fill 4 fields before the tax result is revealed.
  const [seg, setSeg]         = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState(false);
  const [savingSeg, setSavingSeg] = useState(false);
  const segComplete = SEGMENT_FIELDS.every((f) => seg[f.key]);

  // Returning visitors who already submitted skip the gate.
  useEffect(() => {
    if (lsGet("lead_unlocked") === "1") setUnlocked(true);
  }, []);

  // Persist to localStorage so user can come back
  useEffect(() => {
    const saved = lsGet("landing_calc");
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (typeof d.income === "number")  setIncome(d.income);
        if (typeof d.salary === "number")  setSalary(d.salary);
        if (typeof d.expense === "number") setExpense(d.expense);
        if (d.method === "flat60" || d.method === "actual") setMethod(d.method);
        if (d.taxpayer === "individual" || d.taxpayer === "corporate") setTaxpayer(d.taxpayer);
        if (d.incomeMode === "salary" || d.incomeMode === "business" || d.incomeMode === "both") setIncomeMode(d.incomeMode);
        if (typeof d.isSME === "boolean") setIsSME(d.isSME);
        if (d.deductions) setDeductions({ personal: 60_000, ...d.deductions });
      } catch {}
    }
  }, []);
  useEffect(() => {
    lsSet("landing_calc", JSON.stringify({
      income, salary, expense, method, taxpayer, incomeMode, isSME, deductions,
    }));
  }, [income, salary, expense, method, taxpayer, incomeMode, isSME, deductions]);

  const result = useMemo(() => {
    if (taxpayer === "corporate") {
      const profit = Math.max(0, income - expense);
      const { tax, breakdown } = calcCIT(profit, isSME);
      return { kind: "corporate" as const, profit, tax, breakdown };
    }
    // Individual — exclude business income if salary-only mode
    const effectiveIncome = incomeMode === "salary" ? 0 : income;
    const effectiveSalary = incomeMode === "business" ? 0 : salary;
    const grand = effectiveIncome + effectiveSalary;

    const { totalNonDonation, totalDonation } = sumDeductions(deductions, grand);
    const totalDeductions = totalNonDonation + totalDonation;

    // มาตรา 40(8) หักเหมา 60% ไม่มีเพดาน (กฎปัจจุบัน ตั้งแต่ปี 2563)
    const businessDed = effectiveIncome === 0
      ? 0
      : method === "flat60"
        ? effectiveIncome * 0.6
        : expense;
    const salaryDed = Math.min(effectiveSalary * 0.5, 100_000);
    const taxable = Math.max(0, grand - businessDed - salaryDed - totalDeductions);
    const { tax, breakdown } = calcPIT(taxable);
    return {
      kind: "individual" as const,
      grand, businessDed, salaryDed, deduct: totalDeductions,
      effectiveIncome, effectiveSalary,
      taxable, tax, breakdown,
    };
  }, [taxpayer, isSME, income, salary, expense, method, deductions, incomeMode]);

  const hasInput = (incomeMode !== "salary" && income > 0) || (incomeMode !== "business" && salary > 0) || Object.values(deductions).some((v) => v > 0 && v !== 60_000);

  async function submitSegment() {
    if (!segComplete) return;
    setSavingSeg(true);
    const est_income = result.kind === "individual" ? result.grand : income;
    try {
      await fetch("/api/leads", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...seg,
          taxpayer_type: taxpayer,
          est_income,
          est_tax: result.tax,
        }),
      });
    } catch {
      // Network/logging failure shouldn't trap the user — reveal the result anyway.
    } finally {
      setUnlocked(true);
      lsSet("lead_unlocked", "1");
      setSavingSeg(false);
    }
  }

  return (
    <section id="calculator" className="px-6 py-20 max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
          <IconTax className="w-3.5 h-3.5" /> ลองคำนวณเลย · ไม่ต้องสมัคร
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900">คำนวณภาษีฟรี · ใช้ได้ทันที</h2>
        <p className="text-gray-500 text-base">กรอกรายได้ → ดูภาษีโดยประมาณตามอัตรากรมสรรพากร</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">

        {/* LEFT — Inputs */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">

          {/* Taxpayer toggle */}
          <div className="bg-gray-100 rounded-xl p-1 flex">
            <button onClick={() => setTaxpayer("individual")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                taxpayer === "individual" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}>
              บุคคลธรรมดา
            </button>
            <button onClick={() => setTaxpayer("corporate")}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                taxpayer === "corporate" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}>
              นิติบุคคล
            </button>
          </div>

          {/* Individual — income mode + inputs */}
          {taxpayer === "individual" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">แหล่งรายได้</label>
                <div className="bg-gray-100 rounded-xl p-1 grid grid-cols-3 gap-1">
                  <button onClick={() => setIncomeMode("salary")}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      incomeMode === "salary" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}>
                    พนักงานเงินเดือน
                  </button>
                  <button onClick={() => setIncomeMode("business")}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      incomeMode === "business" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}>
                    ขายของ / ธุรกิจ
                  </button>
                  <button onClick={() => setIncomeMode("both")}
                    className={`py-2 rounded-lg text-xs font-semibold transition-all ${
                      incomeMode === "both" ? "bg-blue-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                    }`}>
                    ทั้งคู่
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  {incomeMode === "salary"   && "เงินเดือน / ค่าจ้าง · หักค่าใช้จ่ายเหมา 50% ไม่เกิน 100,000 บาท/ปี อัตโนมัติ"}
                  {incomeMode === "business" && "รายได้จากขายของออนไลน์ / ธุรกิจ · เลือกหักเหมา 60% หรือหักตามจริงได้"}
                  {incomeMode === "both"     && "มีทั้งเงินเดือนประจำและรายได้เสริมจากการขายของ"}
                </p>
              </div>

              {/* Salary income — shown for salary or both */}
              {(incomeMode === "salary" || incomeMode === "both") && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                    เงินเดือน / ค่าจ้างต่อปี
                    <span className="text-gray-400 text-xs ml-1.5">(เงินเดือน × 12 + โบนัส)</span>
                  </label>
                  <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400">
                    <span className="text-gray-400 px-3">฿</span>
                    <input type="text" inputMode="decimal"
                      value={formatInput(salary)}
                      onChange={(e) => setSalary(Math.max(0, parseInput(e.target.value)))}
                      placeholder={incomeMode === "salary" ? "360,000" : "0"}
                      className="flex-1 bg-transparent py-3 pr-3 text-base text-gray-900 outline-none placeholder-gray-400" />
                  </div>
                </div>
              )}

              {/* Business income — shown for business or both */}
              {(incomeMode === "business" || incomeMode === "both") && (
                <>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                      รายได้จากขายของ / ธุรกิจต่อปี
                    </label>
                    <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400">
                      <span className="text-gray-400 px-3">฿</span>
                      <input type="text" inputMode="decimal"
                        value={formatInput(income)}
                        onChange={(e) => setIncome(Math.max(0, parseInput(e.target.value)))}
                        placeholder="600,000"
                        className="flex-1 bg-transparent py-3 pr-3 text-base text-gray-900 outline-none placeholder-gray-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1.5 block">วิธีหักค่าใช้จ่าย (ธุรกิจ)</label>
                    <div className="bg-gray-100 rounded-xl p-1 flex">
                      <button onClick={() => setMethod("flat60")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                          method === "flat60" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                        }`}>
                        หักเหมา 60% (แนะนำ)
                      </button>
                      <button onClick={() => setMethod("actual")}
                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                          method === "actual" ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
                        }`}>
                        หักตามจริง
                      </button>
                    </div>
                  </div>
                  {method === "actual" && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 mb-1.5 block">ค่าใช้จ่ายจริงต่อปี</label>
                      <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400">
                        <span className="text-gray-400 px-3">฿</span>
                        <input type="text" inputMode="decimal"
                          value={formatInput(expense)}
                          onChange={(e) => setExpense(Math.max(0, parseInput(e.target.value)))}
                          placeholder="0"
                          className="flex-1 bg-transparent py-3 pr-3 text-base text-gray-900 outline-none placeholder-gray-400" />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Deductions panel ──────────────────────────────────── */}
              <div className="border border-gray-200 rounded-xl bg-gray-50">
                <button onClick={() => setShowDeductions((v) => !v)}
                  className="w-full flex items-center justify-between text-left p-4">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">ค่าลดหย่อนภาษี</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      รวมลดหย่อนแล้ว ฿{fmt2(result.kind === "individual" ? result.deduct : 60_000)}
                    </p>
                  </div>
                  <span className="text-blue-600 text-xl">{showDeductions ? "−" : "+"}</span>
                </button>

                {showDeductions && (
                  <div className="px-4 pb-4 space-y-5 border-t border-gray-200 pt-4">
                    {(["personal", "insurance", "donation", "stimulus"] as const).map((groupKey) => {
                      // hide locked personal (auto-applied 60k)
                      const items = DEDUCTIONS.filter((d) => d.group === groupKey && d.id !== "personal");
                      if (items.length === 0) return null;
                      return (
                        <div key={groupKey}>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                            {GROUP_LABELS[groupKey]}
                          </p>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <DeductionRow
                                key={item.id}
                                item={item}
                                value={deductions[item.id] ?? 0}
                                onChange={(v) => setDeductions((p) => ({ ...p, [item.id]: v }))}
                                income={(incomeMode === "salary" ? 0 : income) + (incomeMode === "business" ? 0 : salary)}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-700 leading-relaxed">
                      <IconCheck className="w-3.5 h-3.5 inline mr-1" /> หักให้อัตโนมัติแล้ว: ค่าลดหย่อนส่วนตัว 60,000 บาท
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Corporate — income + SME + expenses */}
          {taxpayer === "corporate" && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">รายได้บริษัทต่อปี</label>
                <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400">
                  <span className="text-gray-400 px-3">฿</span>
                  <input type="text" inputMode="decimal"
                    value={formatInput(income)}
                    onChange={(e) => setIncome(Math.max(0, parseInput(e.target.value)))}
                    placeholder="600,000"
                    className="flex-1 bg-transparent py-3 pr-3 text-base text-gray-900 outline-none placeholder-gray-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">ค่าใช้จ่ายธุรกิจต่อปี</label>
                <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 focus-within:border-blue-400">
                  <span className="text-gray-400 px-3">฿</span>
                  <input type="text" inputMode="decimal"
                    value={formatInput(expense)}
                    onChange={(e) => setExpense(Math.max(0, parseInput(e.target.value)))}
                    placeholder="0"
                    className="flex-1 bg-transparent py-3 pr-3 text-base text-gray-900 outline-none placeholder-gray-400" />
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer bg-gray-50 rounded-xl p-3 border border-gray-200">
                <input type="checkbox" checked={isSME} onChange={(e) => setIsSME(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">เป็น SME</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ทุน ≤ 5M + รายได้ ≤ 30M · ≤300k → 0% · 300k–3M → 15% · &gt;3M → 20%
                  </p>
                </div>
              </label>
            </>
          )}
        </div>

        {/* RIGHT — Result */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-50 to-emerald-50 border border-blue-200 rounded-2xl p-6 space-y-4 lg:sticky lg:top-4 shadow-sm">
          {unlocked ? (
          <>
          <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">ภาษีโดยประมาณ</p>
          <p className="text-4xl font-extrabold text-gray-900">฿{fmt2(result.tax)}</p>
          {result.tax === 0 && (
            <p className="text-xs text-emerald-600">รายได้สุทธิไม่ถึงเกณฑ์เสียภาษี</p>
          )}

          <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
            {result.kind === "individual" ? (
              <>
                {result.effectiveSalary > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>เงินเดือน 40(1)</span><span>฿{fmt2(result.effectiveSalary)}</span>
                  </div>
                )}
                {result.effectiveIncome > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>รายได้ธุรกิจ 40(8)</span><span>฿{fmt2(result.effectiveIncome)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-800 font-semibold border-t border-gray-200 pt-2">
                  <span>รายได้รวม</span><span>฿{fmt2(result.grand)}</span>
                </div>
                {result.businessDed > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>หักค่าใช้จ่ายธุรกิจ</span><span>-฿{fmt2(result.businessDed)}</span>
                  </div>
                )}
                {result.salaryDed > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>หักเหมา 50% (เงินเดือน)</span><span>-฿{fmt2(result.salaryDed)}</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-600">
                  <span>ค่าลดหย่อน</span><span>-฿{fmt2(result.deduct)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-2">
                  <span>เงินได้สุทธิ</span><span>฿{fmt2(result.taxable)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>รายได้</span><span>฿{fmt2(income)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>หักค่าใช้จ่ายจริง</span><span>-฿{fmt2(expense)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-semibold border-t border-gray-200 pt-2">
                  <span>กำไรสุทธิ</span><span>฿{fmt2(result.profit)}</span>
                </div>
              </>
            )}
          </div>

          {result.breakdown.length > 0 && (
            <div className="border-t border-gray-200 pt-3 space-y-1.5">
              <p className="text-xs text-gray-500 mb-1">คำนวณแต่ละขั้น</p>
              {result.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-500">{(b.rate * 100).toFixed(0)}% × ฿{fmt2(b.amount)}</span>
                  <span className="text-blue-600 font-semibold">฿{fmt2(b.tax)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Save data CTA */}
          {hasInput && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
              💾 <strong>สมัครฟรี</strong> เพื่อย้ายข้อมูลที่กรอกไว้ (ลดหย่อน + เงินเดือน) ไปบัญชีของคุณอัตโนมัติ
            </div>
          )}

          <Link href="/onboarding?from=calc"
            className="w-full text-center inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors">
            <IconRocket className="w-4 h-4" /> {hasInput ? "สมัครฟรี · เก็บข้อมูลให้" : "สมัครฟรี · ใช้ครบทุกฟีเจอร์"}
          </Link>
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            * ตัวเลขโดยประมาณตามอัตรากรมสรรพากร
          </p>
          </>
          ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mb-2">
                <IconTax className="w-6 h-6" />
              </div>
              <p className="font-bold text-gray-900 text-lg">ดูผลภาษีของคุณ</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                ตอบสั้นๆ 4 ข้อ เพื่อปลดล็อกผลการคำนวณ — ฟรี ไม่ต้องสมัคร
              </p>
            </div>

            {SEGMENT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">{f.label}</label>
                <select
                  value={seg[f.key] ?? ""}
                  onChange={(e) => setSeg((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-xl py-3 px-3 text-base text-gray-900 outline-none focus:border-blue-400"
                >
                  <option value="" disabled>เลือก...</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            ))}

            <button
              onClick={submitSegment}
              disabled={!segComplete || savingSeg}
              className="w-full text-center inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-emerald-500 enabled:hover:bg-emerald-400 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {savingSeg ? "กำลังโหลด..." : (<><IconTax className="w-4 h-4" /> ดูผลภาษี</>)}
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              เราใช้ข้อมูลนี้เพื่อพัฒนาบริการเท่านั้น · ไม่เปิดเผยต่อบุคคลภายนอก
            </p>
          </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <VendeeLogo className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight text-gray-900">Vendee Finance</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Reviewer / demo access (username + password) for platform approvers */}
          <Link
            href="/demo-login"
            className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors border border-gray-200 rounded-full px-3 py-1.5"
          >
            Demo
          </Link>
          <Link
            href="/onboarding"
            className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors inline-flex items-center gap-1"
          >
            เข้าสู่ระบบ <IconArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
          <IconSparkle className="w-3.5 h-3.5" /> สำหรับร้านค้าออนไลน์และ SME ไทย
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6 text-gray-900">
          บัญชีและภาษี{" "}
          <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
            ไม่ยากอีกต่อไป
          </span>
        </h1>

        <p className="text-gray-600 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          แค่ถ่ายรูปใบเสร็จ Vendee Finance จัดการทุกอย่างให้ — บันทึกรายรับรายจ่าย
          คำนวณภาษี ซิงค์ Google Sheets โดยไม่ต้องมีความรู้บัญชีเลย
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shadow-lg shadow-emerald-500/25"
          >
            <IconRocket className="w-5 h-5" /> เริ่มต้นใช้งานฟรี
          </Link>
          <a
            href="#calculator"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 transition-colors shadow-sm"
          >
            <IconTax className="w-4 h-4" /> ลองคำนวณภาษีฟรี
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 mt-14">
          {[
            { value: "ฟรี 100%",      label: "ไม่มีค่าใช้จ่าย" },
            { value: "< 30 วิ",        label: "บันทึกต่อรายการ" },
            { value: "3 แพลตฟอร์ม",   label: "รองรับ TikTok, Shopee, Lazada" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-gray-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900">ทุกอย่างที่ร้านค้าออนไลน์ต้องการ</h2>
          <p className="text-gray-500 text-base">ครบในที่เดียว ใช้งานง่าย ไม่ต้องมีนักบัญชี</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => {
            const Ic = f.Icon;
            return (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className={`bg-gradient-to-br ${f.color} border rounded-2xl p-6 group hover:scale-[1.02] hover:shadow-md transition-all duration-200 block`}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${f.chipBg} ${f.iconColor} mb-4`}>
                  <Ic className="w-6 h-6" />
                </div>
                <h3 className="text-gray-900 font-bold text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                <p className="text-xs text-gray-400 mt-3 group-hover:text-gray-600 transition-colors inline-flex items-center gap-1">
                  อ่านเพิ่มเติม <IconArrowRight className="w-3.5 h-3.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Public Tax Calculator ─────────────────────────────────────────── */}
      <PublicTaxCalculator />

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900">ราคาที่เหมาะกับทุกขนาดธุรกิจ</h2>
          <p className="text-gray-500 text-base">ทดลองใช้ฟรี 7 วัน · ไม่ต้องผูกบัตรเครดิต</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {PLANS.map((plan) => {
            const Badge = plan.badge?.Icon;
            return (
              <div key={plan.name} className={`relative border rounded-2xl p-6 flex flex-col gap-4 shadow-sm ${plan.color}`}>
                {plan.badge && Badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-3 py-1 rounded-full bg-emerald-500 text-white shadow inline-flex items-center gap-1">
                    <Badge className="w-3.5 h-3.5" /> {plan.badge.label}
                  </div>
                )}

                <div>
                  <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-1">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-gray-400 text-sm pb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1">
                  {plan.features.map((f, i) => {
                    const isOff = plan.disabled.includes(i);
                    return (
                      <li key={i} className={`flex items-start gap-2 text-sm ${isOff ? "text-gray-400 line-through" : "text-gray-600"}`}>
                        <span className={`mt-0.5 flex-shrink-0 ${isOff ? "text-gray-300" : "text-emerald-500"}`}>
                          {isOff ? <IconX className="w-4 h-4" /> : <IconCheck className="w-4 h-4" />}
                        </span>
                        {f}
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={plan.planKey ? `/settings?upgrade=${plan.planKey}` : "/onboarding"}
                  className={`w-full text-center py-3 rounded-xl text-sm font-bold transition-colors ${plan.btnClass}`}
                >
                  {plan.name === "Free" ? "เริ่มทดลองใช้ฟรี" : "เลือกแพ็กเกจนี้"}
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          * ทุกแพ็กเกจเริ่มต้นด้วยช่วงทดลอง 7 วันเต็ม (ทุกฟีเจอร์)
        </p>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 text-gray-900">เริ่มต้นใน 3 ขั้นตอน</h2>
          <p className="text-gray-500 text-base">ตั้งค่าครั้งเดียว ใช้ได้ทันที</p>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <div key={s.no} className="flex items-start gap-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#0A192F] flex items-center justify-center text-[#10B981] font-bold text-lg">
                {s.no}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden sm:flex items-center text-gray-300">
                  <IconArrowDown className="w-5 h-5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-3xl p-10 text-center shadow-sm">
          <div className="flex justify-center mb-4">
            <VendeeLogo className="w-14 h-14" />
          </div>
          <h2 className="text-3xl font-bold mb-3 text-gray-900">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            ไม่ต้องดาวน์โหลดแอป ไม่ต้องสมัครใหม่ — เปิดเว็บแล้วเริ่มได้เลย
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shadow-lg shadow-emerald-500/25"
          >
            <IconRocket className="w-5 h-5" /> เริ่มต้นใช้งานฟรี
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-gray-500 text-sm space-y-2">
        <div className="flex justify-center gap-5 text-xs">
          <Link href="/privacy" className="hover:text-gray-800 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-800 transition-colors">Terms of Service</Link>
          <a href="mailto:admin@vendeefinance.com" className="hover:text-gray-800 transition-colors">Contact</a>
        </div>
        <p>© {new Date().getFullYear()} Vendee Finance · สร้างสำหรับร้านค้าออนไลน์ไทย</p>
      </footer>

    </main>
  );
}
