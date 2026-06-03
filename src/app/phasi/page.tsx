"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconTax, IconCheck, IconIncome, IconMusic, IconCart, IconBag, IconNote, IconExpense,
  IconPlus, IconUser,
} from "@/components/icons";
import AppLayout from "@/components/AppLayout";
import {
  DEDUCTIONS, GROUP_LABELS, SHARE_CAPS, maxAllowed, sumDeductions,
  type DeductionItem,
} from "@/lib/deductions";
import { calcPIT, calcCIT, type Breakdown } from "@/lib/tax-calc";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

type RawSummary = {
  year:           number;
  totalIncome:    number;
  platformIncome: number;
  manualIncome:   number;
  totalExpense:   number;
  byPlatform:     Record<string, number>;
  vatWarning:     boolean;
};

type TaxpayerType = "individual" | "corporate";

const fmt    = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

// ─── Deduction input row ─────────────────────────────────────────────────────
function DeductionRow({
  item, value, onChange, income,
}: {
  item: DeductionItem;
  value: number;
  onChange: (v: number) => void;
  income: number;
}) {
  const max = maxAllowed(item, income);
  const used = Math.min(value, max);
  const savings = used; // raw savings amt (actual tax savings depends on bracket)
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;

  // ส่วนตัว: bind 60k by default, not editable
  const isAutoLocked = item.id === "personal";
  const display = isAutoLocked ? 60_000 : value;

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{item.label}</p>
          {item.desc && <p className="text-xs text-gray-400 mt-0.5 leading-tight">{item.desc}</p>}
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 font-medium">
          สูงสุด ฿{fmtInt(max)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-gray-50 rounded-lg overflow-hidden border border-gray-200 focus-within:border-blue-400">
          <span className="text-gray-400 px-2 text-sm">฿</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            disabled={isAutoLocked}
            value={display || ""}
            onChange={(e) => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
            placeholder="0"
            className="flex-1 bg-transparent py-2 px-1 text-sm outline-none disabled:text-gray-500"
          />
          <button
            type="button"
            disabled={isAutoLocked}
            onClick={() => onChange(max)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-2 py-1 disabled:opacity-40"
            title="ใช้สูงสุด"
          >
            Max
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-emerald-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {savings > 0 && (
        <p className="text-xs text-emerald-600 mt-1.5">
          ลดหย่อนได้ ฿{fmtInt(used)}
          {used < value && <span className="text-amber-500 ml-1">(เกินเพดาน ตัดเหลือ ฿{fmtInt(used)})</span>}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PhasiPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [raw,        setRaw]        = useState<RawSummary | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Tax payer type
  const [taxpayer, setTaxpayer] = useState<TaxpayerType>("individual");
  const [isSME,    setIsSME]    = useState(true);

  // Other income types (40(1) salary, 40(2) commission) — for combined 100k cap
  const [salaryIncome,     setSalaryIncome]     = useState(0); // 40(1)
  const [commissionIncome, setCommissionIncome] = useState(0); // 40(2)
  const [showOtherIncome,  setShowOtherIncome]  = useState(false);

  // Deductions state — key: item id, value: THB
  const [deductions, setDeductions] = useState<Record<string, number>>({ personal: 60_000 });
  const [showDeductions, setShowDeductions] = useState(false);
  const [migratedBanner, setMigratedBanner] = useState(false);

  const { data: session, status: sessionStatus } = useSession();

  // ── Resolve user ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolveUser() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        try {
          const { default: liff } = await import("@line/liff");
          await liff.init({ liffId });
          if (!liff.isLoggedIn() && !liff.isInClient() && /Line\//i.test(navigator.userAgent)) {
            window.location.replace(`https://liff.line.me/${liffId}`);
            return;
          }
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            setLineUserId(p.userId);
            setAuthReady(true);
            return;
          }
          if (liff.isInClient()) { liff.login(); return; }
        } catch { /* not in LINE */ }
      }
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.lineUserId) setLineUserId(d.lineUserId);
          }
        } catch { /* ignore */ }
      }
      setAuthReady(true);
    }
    resolveUser();
  }, [sessionStatus, session]);

  // ── Fetch raw summary ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!authReady || !lineUserId) { if (authReady) setLoading(false); return; }
    setLoading(true);
    fetch(`/api/tax/summary?lineUserId=${lineUserId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setRaw(d); })
      .finally(() => setLoading(false));
  }, [authReady, lineUserId, year]);

  // ── Load saved deductions from localStorage ────────────────────────────────
  useEffect(() => {
    const key = `taxbot_deductions_${year}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try { setDeductions({ personal: 60_000, ...JSON.parse(saved) }); } catch {}
    }
    const tp = localStorage.getItem("taxbot_taxpayer");
    if (tp === "individual" || tp === "corporate") setTaxpayer(tp);
    const sme = localStorage.getItem("taxbot_is_sme");
    if (sme !== null) setIsSME(sme === "1");
    const sal = localStorage.getItem(`taxbot_salary_${year}`);
    if (sal) setSalaryIncome(parseFloat(sal) || 0);
    const com = localStorage.getItem(`taxbot_commission_${year}`);
    if (com) setCommissionIncome(parseFloat(com) || 0);

    // ── Migrate from landing-page calculator (one-time) ────────────────────
    // If user filled in the public calculator before signup, port that into
    // their account-bound data. Only migrate fields that aren't already set.
    const landing = localStorage.getItem("taxbot_landing_calc");
    if (landing) {
      try {
        const d = JSON.parse(landing);
        let migrated = false;
        if (!saved && d.deductions && typeof d.deductions === "object") {
          setDeductions({ personal: 60_000, ...d.deductions });
          migrated = true;
        }
        if (!sal && typeof d.salary === "number" && d.salary > 0) {
          setSalaryIncome(d.salary);
          migrated = true;
        }
        if (tp === null && (d.taxpayer === "individual" || d.taxpayer === "corporate")) {
          setTaxpayer(d.taxpayer);
        }
        if (sme === null && typeof d.isSME === "boolean") {
          setIsSME(d.isSME);
        }
        if (migrated) setMigratedBanner(true);
      } catch {}
      // Clear after migration so it doesn't re-trigger
      localStorage.removeItem("taxbot_landing_calc");
    }
  }, [year]);

  // ── Persist deductions ─────────────────────────────────────────────────────
  useEffect(() => {
    const key = `taxbot_deductions_${year}`;
    localStorage.setItem(key, JSON.stringify(deductions));
  }, [deductions, year]);

  useEffect(() => { localStorage.setItem("taxbot_taxpayer", taxpayer); }, [taxpayer]);
  useEffect(() => { localStorage.setItem("taxbot_is_sme", isSME ? "1" : "0"); }, [isSME]);
  useEffect(() => { localStorage.setItem(`taxbot_salary_${year}`,     String(salaryIncome));     }, [salaryIncome, year]);
  useEffect(() => { localStorage.setItem(`taxbot_commission_${year}`, String(commissionIncome)); }, [commissionIncome, year]);

  // ── Compute taxes ─────────────────────────────────────────────────────────
  const compute = useMemo(() => {
    if (!raw) return null;
    const businessIncome = raw.totalIncome;                       // 40(8)
    const totalExpense   = raw.totalExpense;
    const salary40_1     = Math.max(0, salaryIncome);             // 40(1)
    const commission40_2 = Math.max(0, commissionIncome);         // 40(2)

    // มาตรา 40(1)+40(2): หักเหมา 50% รวมกันไม่เกิน 100,000 บาท (auto)
    const totalSalaryComm = salary40_1 + commission40_2;
    const salaryFlatDed   = Math.min(totalSalaryComm * 0.5, 100_000);

    const grandIncome = businessIncome + totalSalaryComm;

    if (taxpayer === "individual") {
      const { totalNonDonation, totalDonation } = sumDeductions(deductions, grandIncome);
      const totalDeductions = totalNonDonation + totalDonation;

      // Method 1: ธุรกิจหักเหมา 60% + เงินเดือนหัก 50% (≤100k auto)
      // มาตรา 40(8) หักเหมา 60% ไม่มีเพดาน (กฎปัจจุบัน ตั้งแต่ปี 2563)
      const std1Business = businessIncome * 0.6;
      const taxable1     = Math.max(0, grandIncome - std1Business - salaryFlatDed - totalDeductions);
      const { tax: tax1, breakdown: bd1 } = calcPIT(taxable1);

      // Method 2: ธุรกิจหักตามจริง + เงินเดือนหัก 50%
      const taxable2     = Math.max(0, grandIncome - totalExpense - salaryFlatDed - totalDeductions);
      const { tax: tax2, breakdown: bd2 } = calcPIT(taxable2);

      return {
        kind: "individual" as const,
        grandIncome, businessIncome, totalSalaryComm, salaryFlatDed,
        method1: { label: "หักเหมา 60%",  expense: std1Business, taxable: taxable1, tax: tax1, breakdown: bd1 },
        method2: { label: "หักตามจริง",   expense: totalExpense, taxable: taxable2, tax: tax2, breakdown: bd2 },
        recommended: (tax1 <= tax2 ? 1 : 2) as 1 | 2,
        savings: Math.abs(tax1 - tax2),
        totalDeductions, totalNonDonation, totalDonation,
      };
    }

    // Corporate — 40(1)/40(2) ไม่เกี่ยว ใช้แค่กำไรสุทธิ
    const netProfit = Math.max(0, businessIncome - totalExpense);
    const { tax, breakdown } = calcCIT(netProfit, isSME);
    return { kind: "corporate" as const, netProfit, tax, breakdown };
  }, [raw, deductions, taxpayer, isSME, salaryIncome, commissionIncome]);

  return (
    <AppLayout title="ภาษี">
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/home" className="text-blue-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <IconTax />
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-700">สรุปภาษี</h1>
              <p className="text-blue-400 text-sm">Tax Summary</p>
            </div>
          </div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-white border border-blue-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Taxpayer-type toggle */}
        <div className="bg-white rounded-2xl border border-blue-100 p-2 mb-5 flex">
          <button onClick={() => setTaxpayer("individual")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              taxpayer === "individual" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
            }`}>
            บุคคลธรรมดา
          </button>
          <button onClick={() => setTaxpayer("corporate")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              taxpayer === "corporate" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500 hover:bg-gray-50"
            }`}>
            นิติบุคคล (บริษัท)
          </button>
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-16">กำลังคำนวณ...</p>
        ) : !raw || !compute ? (
          <p className="text-center text-gray-400 py-16">ไม่พบข้อมูล</p>
        ) : (
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

            {/* LEFT — Income + deductions */}
            <div className="space-y-4 mb-6 lg:mb-0">

              {migratedBanner && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                  <span className="text-emerald-500 flex-shrink-0 mt-0.5"><IconCheck className="w-5 h-5" /></span>
                  <div className="flex-1">
                    <p className="text-emerald-800 font-semibold text-sm">บันทึกข้อมูลที่กรอกไว้ก่อนสมัครแล้ว</p>
                    <p className="text-emerald-600 text-xs mt-0.5">เราย้ายค่าลดหย่อนและเงินเดือนที่คุณกรอกไว้ในหน้าคำนวณภาษีมาให้บัญชีนี้แล้ว</p>
                  </div>
                  <button onClick={() => setMigratedBanner(false)}
                    className="text-emerald-400 hover:text-emerald-600 text-xl leading-none">×</button>
                </div>
              )}

              {raw.vatWarning && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-red-700 font-semibold text-sm">⚠️ รายได้เกิน 1,800,000 บาท</p>
                  <p className="text-red-500 text-xs mt-1">คุณอาจต้องจดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</p>
                </div>
              )}

              {/* Income summary */}
              <div className="bg-white rounded-2xl border border-blue-100 p-5">
                <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5">
                  <IconIncome className="w-4 h-4 text-emerald-500" /> รายได้รวม ปี {year}
                </p>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-700 font-medium text-sm">รวมทั้งหมด</span>
                  <span className="font-bold text-gray-900 text-xl">
                    ฿{fmt(compute.kind === "individual" ? compute.grandIncome : raw.totalIncome)}
                  </span>
                </div>

                {/* ─── รายได้จากธุรกิจ (40(8)) ─────────────────────────── */}
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    ขายของ / ธุรกิจ — มาตรา 40(8)
                  </p>
                  {Object.entries(raw.byPlatform).map(([p, amt]) => (
                    <div key={p} className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm inline-flex items-center gap-1.5">
                        {p === "tiktok" ? <><IconMusic className="w-3.5 h-3.5" /> TikTok Shop</> :
                         p === "shopee" ? <><IconCart className="w-3.5 h-3.5" /> Shopee</> :
                                          <><IconBag className="w-3.5 h-3.5" /> Lazada</>}
                      </span>
                      <span className="text-gray-700 text-sm font-medium">฿{fmtInt(amt)}</span>
                    </div>
                  ))}
                  {raw.manualIncome > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm inline-flex items-center gap-1.5"><IconNote className="w-3.5 h-3.5" /> บันทึกเอง</span>
                      <span className="text-gray-700 text-sm font-medium">฿{fmtInt(raw.manualIncome)}</span>
                    </div>
                  )}
                  {raw.totalExpense > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm inline-flex items-center gap-1.5"><IconExpense className="w-3.5 h-3.5" /> ค่าใช้จ่ายที่บันทึก</span>
                      <span className="text-red-500 text-sm font-medium">-฿{fmtInt(raw.totalExpense)}</span>
                    </div>
                  )}
                </div>

                {/* ─── เงินเดือน / ค่านายหน้า (40(1)+(2)) ─────────────── */}
                {taxpayer === "individual" && (
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                        เงินเดือน / ค่านายหน้า — มาตรา 40(1)–(2)
                      </p>
                      <button
                        onClick={() => setShowOtherIncome((v) => !v)}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                      >
                        {showOtherIncome ? "เก็บ" : (salaryIncome + commissionIncome > 0 ? "แก้ไข" : <><IconPlus className="w-3.5 h-3.5" /> เพิ่ม</>)}
                      </button>
                    </div>

                    {/* Display when not editing AND has values */}
                    {!showOtherIncome && (salaryIncome > 0 || commissionIncome > 0) && (
                      <div className="space-y-1.5">
                        {salaryIncome > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm inline-flex items-center gap-1.5"><IconUser className="w-3.5 h-3.5" /> เงินเดือน (40(1))</span>
                            <span className="text-gray-700 text-sm font-medium">฿{fmtInt(salaryIncome)}</span>
                          </div>
                        )}
                        {commissionIncome > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm inline-flex items-center gap-1.5"><IconNote className="w-3.5 h-3.5" /> ค่านายหน้า (40(2))</span>
                            <span className="text-gray-700 text-sm font-medium">฿{fmtInt(commissionIncome)}</span>
                          </div>
                        )}
                        {compute.kind === "individual" && compute.salaryFlatDed > 0 && (
                          <div className="flex justify-between items-center text-emerald-600 pt-1">
                            <span className="text-xs inline-flex items-center gap-1">
                              <IconCheck className="w-3 h-3" /> หักเหมา 50% อัตโนมัติ
                              {compute.salaryFlatDed >= 100_000 && <span className="text-gray-400">(เพดาน 100k)</span>}
                            </span>
                            <span className="text-xs font-semibold">-฿{fmtInt(compute.salaryFlatDed)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Empty hint when nothing entered */}
                    {!showOtherIncome && salaryIncome === 0 && commissionIncome === 0 && (
                      <p className="text-xs text-gray-400 leading-relaxed">
                        ถ้าคุณมีเงินเดือนประจำ หรือค่านายหน้านอกจากการขายของ — กดเพิ่มเพื่อให้คำนวณภาษีถูกต้อง
                      </p>
                    )}

                    {/* Edit mode */}
                    {showOtherIncome && (
                      <div className="space-y-3 mt-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">เงินเดือน / ค่าจ้าง รายปี (40(1))</label>
                          <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 focus-within:border-blue-400">
                            <span className="text-gray-400 px-2 text-sm">฿</span>
                            <input type="number" inputMode="decimal" min={0}
                              value={salaryIncome || ""}
                              onChange={(e) => setSalaryIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="0"
                              className="flex-1 bg-transparent py-2 px-1 text-sm outline-none" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">ค่านายหน้า / ค่าธรรมเนียม รายปี (40(2))</label>
                          <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 focus-within:border-blue-400">
                            <span className="text-gray-400 px-2 text-sm">฿</span>
                            <input type="number" inputMode="decimal" min={0}
                              value={commissionIncome || ""}
                              onChange={(e) => setCommissionIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                              placeholder="0"
                              className="flex-1 bg-transparent py-2 px-1 text-sm outline-none" />
                          </div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5 text-xs text-emerald-700 leading-relaxed">
                          <IconCheck className="w-3.5 h-3.5 inline mr-1" />
                          ระบบหักค่าใช้จ่ายเหมา 50% ของยอดรวม 40(1)+40(2) สูงสุด 100,000 บาท/ปี ให้อัตโนมัติ
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Corporate SME option */}
              {taxpayer === "corporate" && (
                <div className="bg-white rounded-2xl border border-blue-100 p-5">
                  <p className="font-semibold text-gray-700 text-sm mb-3">ประเภทกิจการ</p>
                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:border-blue-300">
                    <input type="checkbox" checked={isSME} onChange={(e) => setIsSME(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600" />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">เป็น SME</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ทุนจดทะเบียน ≤ 5 ล้าน + รายได้ ≤ 30 ล้าน/ปี <br/>
                        อัตราพิเศษ: ≤300k → 0% · 300k–3M → 15% · &gt;3M → 20%
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Deductions panel — individual only */}
              {taxpayer === "individual" && compute.kind === "individual" && (
                <div className="bg-white rounded-2xl border border-blue-100 p-5">
                  <button onClick={() => setShowDeductions((v) => !v)}
                    className="w-full flex items-center justify-between text-left">
                    <div>
                      <p className="font-semibold text-gray-700 text-sm">ค่าลดหย่อนภาษี</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        รวมลดหย่อนแล้ว ฿{fmtInt(compute.totalDeductions)}
                      </p>
                    </div>
                    <span className="text-blue-500 text-xl">{showDeductions ? "−" : "+"}</span>
                  </button>

                  {showDeductions && (
                    <div className="mt-4 space-y-5">
                      {(["personal", "insurance", "donation", "stimulus"] as const).map((groupKey) => {
                        // hide locked auto-deduction (personal 60k) — applied automatically
                        const items = DEDUCTIONS.filter((d) => d.group === groupKey && d.id !== "personal");
                        if (items.length === 0) return null;
                        return (
                          <div key={groupKey}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                              {GROUP_LABELS[groupKey]}
                            </p>
                            <div className="space-y-2">
                              {items.map((item) => (
                                <DeductionRow
                                  key={item.id}
                                  item={item}
                                  value={deductions[item.id] ?? 0}
                                  onChange={(v) => setDeductions((p) => ({ ...p, [item.id]: v }))}
                                  income={raw.totalIncome}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                        ✅ <strong>หักให้อัตโนมัติแล้ว:</strong> ค่าลดหย่อนส่วนตัว 60,000 บาท
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                        💡 รายการที่อยู่ในเพดานเดียวกันระบบจะคำนวณให้อัตโนมัติ <br/>
                        เช่น ประกันชีวิต + สุขภาพตนเอง รวมไม่เกิน 100,000 บาท
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-gray-400 text-center pb-2">
                * ประมาณการเบื้องต้น อ้างอิงอัตราภาษี{taxpayer === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}ปัจจุบัน <br/>
                ควรปรึกษานักบัญชีก่อนยื่นภาษีจริง
              </p>
            </div>

            {/* RIGHT — Tax cards */}
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {compute.kind === "individual" ? "เปรียบเทียบวิธีคำนวณภาษี" : "ภาษีนิติบุคคล"}
              </p>

              {compute.kind === "individual" ? (
                <>
                  {compute.savings > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                      <span className="text-2xl flex-shrink-0">💡</span>
                      <div>
                        <p className="text-amber-800 font-semibold text-sm">
                          วิธีที่ {compute.recommended} ประหยัดกว่า ฿{fmtInt(compute.savings)}
                        </p>
                      </div>
                    </div>
                  )}
                  <PITMethodCard
                    index={1}
                    label={compute.method1.label}
                    expenseLabel="หักค่าใช้จ่ายเหมา 60% (40(8))"
                    expense={compute.method1.expense}
                    salaryFlatDed={compute.salaryFlatDed}
                    deductions={compute.totalDeductions}
                    taxable={compute.method1.taxable}
                    tax={compute.method1.tax}
                    breakdown={compute.method1.breakdown}
                    income={compute.grandIncome}
                    recommended={compute.recommended === 1}
                  />
                  <PITMethodCard
                    index={2}
                    label={compute.method2.label}
                    expenseLabel="หักค่าใช้จ่ายจริง (40(8))"
                    expense={compute.method2.expense}
                    salaryFlatDed={compute.salaryFlatDed}
                    deductions={compute.totalDeductions}
                    taxable={compute.method2.taxable}
                    tax={compute.method2.tax}
                    breakdown={compute.method2.breakdown}
                    income={compute.grandIncome}
                    recommended={compute.recommended === 2}
                  />
                </>
              ) : (
                <CITCard
                  income={raw.totalIncome}
                  expense={raw.totalExpense}
                  netProfit={compute.netProfit}
                  tax={compute.tax}
                  breakdown={compute.breakdown}
                  isSME={isSME}
                />
              )}
            </div>

          </div>
        )}
      </div>
    </main>
    </AppLayout>
  );
}

// ─── PIT method card ──────────────────────────────────────────────────────────
function PITMethodCard({
  index, label, expenseLabel, expense, salaryFlatDed, deductions, taxable, tax, breakdown, income, recommended,
}: {
  index: 1 | 2;
  label: string;
  expenseLabel: string;
  expense: number;
  salaryFlatDed: number;
  deductions: number;
  taxable: number;
  tax: number;
  breakdown: Breakdown[];
  income: number;
  recommended: boolean;
}) {
  return (
    <div className={`rounded-2xl border-2 p-4 ${
      recommended ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            recommended ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
          }`}>
            วิธีที่ {index}
          </span>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        {recommended && (
          <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
            <IconCheck className="w-3 h-3" /> แนะนำ
          </span>
        )}
      </div>

      <div className={`rounded-xl p-3 mb-3 ${recommended ? "bg-blue-600" : "bg-gray-100"}`}>
        <p className={`text-xs mb-0.5 ${recommended ? "text-blue-100" : "text-gray-500"}`}>ภาษีโดยประมาณ</p>
        <p className={`text-2xl font-bold ${recommended ? "text-white" : "text-gray-800"}`}>฿{fmt(tax)}</p>
        {tax === 0 && (
          <p className={`text-xs mt-0.5 ${recommended ? "text-blue-200" : "text-gray-400"}`}>
            รายได้สุทธิไม่ถึงเกณฑ์เสียภาษี
          </p>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>รายได้รวม</span><span>฿{fmtInt(income)}</span>
        </div>
        <div className="flex justify-between text-emerald-600">
          <span>{expenseLabel}</span>
          <span>-฿{fmtInt(expense)}</span>
        </div>
        {salaryFlatDed > 0 && (
          <div className="flex justify-between text-emerald-600">
            <span>หักเหมา 50% (40(1)+(2)){salaryFlatDed >= 100_000 && (
              <span className="text-xs text-gray-400 ml-1">(สูงสุด 100k)</span>
            )}</span>
            <span>-฿{fmtInt(salaryFlatDed)}</span>
          </div>
        )}
        <div className="flex justify-between text-emerald-600">
          <span>ค่าลดหย่อนรวม</span>
          <span>-฿{fmtInt(deductions)}</span>
        </div>
        <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-2">
          <span>เงินได้สุทธิ</span><span>฿{fmtInt(taxable)}</span>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-xs text-gray-400 mb-1">คำนวณแต่ละขั้นภาษี</p>
          {breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">
                {(b.rate * 100).toFixed(0)}%<span className="text-gray-400 ml-1">× ฿{fmtInt(b.amount)}</span>
              </span>
              <span className={`font-semibold ${recommended ? "text-blue-700" : "text-gray-600"}`}>
                ฿{fmtInt(b.tax)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Corporate tax card ──────────────────────────────────────────────────────
function CITCard({
  income, expense, netProfit, tax, breakdown, isSME,
}: {
  income: number;
  expense: number;
  netProfit: number;
  tax: number;
  breakdown: Breakdown[];
  isSME: boolean;
}) {
  return (
    <div className="rounded-2xl border-2 border-blue-500 bg-blue-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">
          {isSME ? "อัตราภาษี SME" : "อัตราภาษีนิติบุคคล (20%)"}
        </span>
        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
          <IconCheck className="w-3 h-3" /> {isSME ? "SME" : "บริษัททั่วไป"}
        </span>
      </div>

      <div className="rounded-xl p-3 mb-3 bg-blue-600">
        <p className="text-xs mb-0.5 text-blue-100">ภาษีโดยประมาณ</p>
        <p className="text-2xl font-bold text-white">฿{fmt(tax)}</p>
        {tax === 0 && <p className="text-xs mt-0.5 text-blue-200">กำไรสุทธิไม่ถึงเกณฑ์เสียภาษี</p>}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>รายได้รวม</span><span>฿{fmtInt(income)}</span></div>
        <div className="flex justify-between text-emerald-600"><span>หักค่าใช้จ่ายจริง</span><span>-฿{fmtInt(expense)}</span></div>
        <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-2">
          <span>กำไรสุทธิ</span><span>฿{fmtInt(netProfit)}</span>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-xs text-gray-400 mb-1">คำนวณแต่ละขั้น</p>
          {breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">{(b.rate * 100).toFixed(0)}%<span className="text-gray-400 ml-1">× ฿{fmtInt(b.amount)}</span></span>
              <span className="font-semibold text-blue-700">฿{fmtInt(b.tax)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
        นิติบุคคลใช้กำไรสุทธิเป็นฐานภาษี ไม่มีค่าลดหย่อนส่วนตัว <br/>
        การลดหย่อนสำหรับบริษัทใช้รูปแบบ "ค่าใช้จ่ายที่หักได้เพิ่ม" เช่น R&D, การจ้างผู้สูงอายุ ฯลฯ <br/>
        ดูรายละเอียดเต็มที่ <a href="https://www.rd.go.th/43338.html" target="_blank" rel="noopener" className="text-blue-500 underline">กรมสรรพากร</a>
      </div>
    </div>
  );
}
