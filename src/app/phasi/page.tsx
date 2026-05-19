"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type Breakdown = { rate: number; amount: number; tax: number };

type MethodSummary = {
  label:              string;
  standardDeduction?: number;
  actualExpense?:     number;
  totalDeductions:    number;
  taxableIncome:      number;
  estimatedTax:       number;
  breakdown:          Breakdown[];
};

type TaxSummary = {
  year:              number;
  totalIncome:       number;
  platformIncome:    number;
  manualIncome:      number;
  totalExpense:      number;
  byPlatform:        Record<string, number>;
  personalAllowance: number;
  method1:           MethodSummary;
  method2:           MethodSummary;
  recommended:       1 | 2;
  savings:           number;
  vatWarning:        boolean;
};

const fmt    = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

function MethodCard({
  method,
  index,
  recommended,
  totalIncome,
  personalAllowance,
}: {
  method: MethodSummary;
  index: 1 | 2;
  recommended: 1 | 2;
  totalIncome: number;
  personalAllowance: number;
}) {
  const isRecommended = index === recommended;

  return (
    <div className={`rounded-2xl border-2 p-4 ${
      isRecommended ? "border-blue-500 bg-blue-50" : "border-gray-100 bg-white"
    }`}>
      {/* Card header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isRecommended ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-500"
          }`}>
            วิธีที่ {index}
          </span>
          <span className="text-sm font-semibold text-gray-700">{method.label}</span>
        </div>
        {isRecommended && (
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
            ✅ แนะนำ
          </span>
        )}
      </div>

      {/* Tax amount hero */}
      <div className={`rounded-xl p-3 mb-3 ${isRecommended ? "bg-blue-600" : "bg-gray-100"}`}>
        <p className={`text-xs mb-0.5 ${isRecommended ? "text-blue-100" : "text-gray-500"}`}>
          ภาษีโดยประมาณ
        </p>
        <p className={`text-2xl font-bold ${isRecommended ? "text-white" : "text-gray-800"}`}>
          ฿{fmt(method.estimatedTax)}
        </p>
        {method.estimatedTax === 0 && (
          <p className={`text-xs mt-0.5 ${isRecommended ? "text-blue-200" : "text-gray-400"}`}>
            รายได้สุทธิไม่ถึงเกณฑ์เสียภาษี
          </p>
        )}
      </div>

      {/* Deduction breakdown */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>รายได้รวม</span>
          <span>฿{fmtInt(totalIncome)}</span>
        </div>

        {index === 1 ? (
          <div className="flex justify-between text-emerald-600">
            <div>
              <span>หักค่าใช้จ่ายเหมา 60%</span>
              {(method.standardDeduction ?? 0) >= 600_000 && (
                <span className="text-xs text-gray-400 ml-1">(สูงสุด 600k)</span>
              )}
            </div>
            <span>-฿{fmtInt(method.standardDeduction ?? 0)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-emerald-600">
            <span>หักค่าใช้จ่ายจริง</span>
            <span>-฿{fmtInt(method.actualExpense ?? 0)}</span>
          </div>
        )}

        <div className="flex justify-between text-emerald-600">
          <span>ค่าลดหย่อนส่วนตัว</span>
          <span>-฿{fmtInt(personalAllowance)}</span>
        </div>

        <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-2">
          <span>เงินได้สุทธิ</span>
          <span>฿{fmtInt(method.taxableIncome)}</span>
        </div>
      </div>

      {/* Tax brackets */}
      {method.breakdown.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-xs text-gray-400 mb-1">คำนวณแต่ละขั้นภาษี</p>
          {method.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-500">
                {(b.rate * 100).toFixed(0)}%
                <span className="text-gray-400 ml-1">× ฿{fmtInt(b.amount)}</span>
              </span>
              <span className={`font-semibold ${isRecommended ? "text-blue-700" : "text-gray-600"}`}>
                ฿{fmtInt(b.tax)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PhasiPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [summary,    setSummary]    = useState<TaxSummary | null>(null);
  const [loading,    setLoading]    = useState(true);

  const { data: session, status: sessionStatus } = useSession();

  // Resolve LINE user ID — LIFF first, Google session fallback
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolveUser() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        try {
          const { default: liff } = await import("@line/liff");
          await liff.init({ liffId });
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            setLineUserId(p.userId);
            setAuthReady(true);
            return;
          }
          // Inside LINE app but not logged in → force LIFF login
          if (liff.isInClient()) {
            liff.login();
            return;
          }
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

  // Fetch tax summary
  useEffect(() => {
    if (!authReady || !lineUserId) {
      if (authReady) setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/tax/summary?lineUserId=${lineUserId}&year=${year}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSummary(d); })
      .finally(() => setLoading(false));
  }, [authReady, lineUserId, year]);

  return (
    <main className="min-h-screen bg-blue-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-blue-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <div className="text-4xl">📊</div>
          <div>
            <h1 className="text-xl font-bold text-blue-700">สรุปภาษี</h1>
            <p className="text-blue-400 text-sm">Tax Summary</p>
          </div>
        </div>

        {/* Year selector */}
        <div className="flex gap-2 mb-5">
          {YEARS.map((y) => (
            <button key={y} onClick={() => setYear(y)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                year === y ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-500 border border-blue-100"
              }`}>
              {y}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-16">กำลังคำนวณ...</p>
        ) : !summary ? (
          <p className="text-center text-gray-400 py-16">ไม่พบข้อมูล</p>
        ) : (
          <>
            {/* VAT Warning */}
            {summary.vatWarning && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-red-700 font-semibold text-sm">⚠️ รายได้เกิน 1,800,000 บาท</p>
                <p className="text-red-500 text-xs mt-1">คุณอาจต้องจดทะเบียนภาษีมูลค่าเพิ่ม (VAT)</p>
              </div>
            )}

            {/* Income summary card */}
            <div className="bg-white rounded-2xl border border-blue-100 p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">💰 รายได้รวม ปี {year}</p>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-700 font-medium text-sm">รวมทั้งหมด</span>
                <span className="font-bold text-gray-900 text-lg">฿{fmt(summary.totalIncome)}</span>
              </div>
              <div className="space-y-1.5 border-t border-gray-50 pt-3">
                {Object.entries(summary.byPlatform).map(([p, amt]) => (
                  <div key={p} className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">
                      {p === "tiktok" ? "🎵 TikTok Shop" : p === "shopee" ? "🛒 Shopee" : "📦 Lazada"}
                    </span>
                    <span className="text-gray-600 text-xs font-medium">฿{fmtInt(amt)}</span>
                  </div>
                ))}
                {summary.manualIncome > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-xs">📝 บันทึกเอง</span>
                    <span className="text-gray-600 text-xs font-medium">฿{fmtInt(summary.manualIncome)}</span>
                  </div>
                )}
                {summary.totalExpense > 0 && (
                  <div className="flex justify-between items-center border-t border-gray-50 pt-2 mt-1">
                    <span className="text-gray-400 text-xs">🧾 ค่าใช้จ่ายที่บันทึก</span>
                    <span className="text-red-400 text-xs font-medium">฿{fmtInt(summary.totalExpense)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Savings banner */}
            {summary.savings > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div>
                  <p className="text-amber-800 font-semibold text-sm">
                    วิธีที่ {summary.recommended} ประหยัดกว่า ฿{fmtInt(summary.savings)}
                  </p>
                  <p className="text-amber-600 text-xs mt-0.5">
                    {summary.recommended === 1
                      ? "หักเหมา 60% ให้ผลดีกว่าค่าใช้จ่ายจริงที่บันทึกไว้"
                      : "ค่าใช้จ่ายจริงช่วยลดภาษีได้มากกว่าการหักเหมา"}
                  </p>
                </div>
              </div>
            )}

            {/* Method comparison */}
            <p className="text-xs font-semibold text-gray-500 mb-2 px-1">เปรียบเทียบวิธีคำนวณภาษี</p>
            <div className="space-y-3 mb-4">
              <MethodCard
                method={summary.method1}
                index={1}
                recommended={summary.recommended}
                totalIncome={summary.totalIncome}
                personalAllowance={summary.personalAllowance}
              />
              <MethodCard
                method={summary.method2}
                index={2}
                recommended={summary.recommended}
                totalIncome={summary.totalIncome}
                personalAllowance={summary.personalAllowance}
              />
            </div>

            {/* Nudge when no expenses recorded */}
            {summary.totalExpense === 0 && (
              <div className="mb-4 bg-gray-50 border border-gray-100 rounded-2xl p-3">
                <p className="text-gray-500 text-xs leading-relaxed">
                  📝 <strong>วิธีที่ 2</strong> ยังไม่มีค่าใช้จ่ายที่บันทึกไว้
                  — บันทึกรายจ่ายใน<Link href="/rairab" className="text-blue-500 underline mx-1">หน้ารายรับ-รายจ่าย</Link>
                  เพื่อเปรียบเทียบผล
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-2 px-4 pb-4">
              * ประมาณการเบื้องต้น ไม่รวมลดหย่อนอื่นๆ ควรปรึกษานักบัญชีเพื่อยื่นภาษีจริง
            </p>
          </>
        )}
      </div>
    </main>
  );
}
