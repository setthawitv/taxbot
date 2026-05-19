"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Platform = "all" | "tiktok" | "shopee" | "lazada";

type Summary = {
  total:      number;
  count:      number;
  byPlatform: Record<string, number>;
  byMonth:    { month: number; total: number }[];
};

const PLATFORM_OPTIONS: { id: Platform; label: string; emoji: string; color: string }[] = [
  { id: "all",    label: "ทั้งหมด",    emoji: "📊", color: "bg-emerald-500" },
  { id: "tiktok", label: "TikTok",     emoji: "🎵", color: "bg-gray-800"   },
  { id: "shopee", label: "Shopee",     emoji: "🛒", color: "bg-orange-500" },
  { id: "lazada", label: "Lazada",     emoji: "📦", color: "bg-blue-600"   },
];

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

export default function RaiRab() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [month,      setMonth]      = useState(0); // 0 = all months
  const [platform,   setPlatform]   = useState<Platform>("all");
  const [summary,    setSummary]    = useState<Summary | null>(null);
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
          // Inside LINE app but not logged in → force LIFF login
          if (liff.isInClient()) {
            liff.login();
            return;
          }
        } catch { /* not in LINE */ }
      }
      // Fallback: Google session
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

  // Fetch summary whenever filters change
  useEffect(() => {
    if (!authReady || !lineUserId) {
      if (authReady) setLoading(false); // not logged in — stop spinner
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      lineUserId,
      year:     String(year),
      month:    String(month),
      platform,
    });
    fetch(`/api/income/summary?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSummary(d); })
      .finally(() => setLoading(false));
  }, [lineUserId, year, month, platform]);

  const maxMonthTotal = Math.max(...(summary?.byMonth.map((m) => m.total) ?? [1]), 1);

  const pl = PLATFORM_OPTIONS.find((p) => p.id === platform)!;

  return (
    <main className="min-h-screen bg-emerald-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-emerald-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="text-4xl">💰</div>
            <div>
              <h1 className="text-xl font-bold text-emerald-700">รายรับ</h1>
              <p className="text-emerald-500 text-sm">Income Dashboard</p>
            </div>
          </div>
          <Link
            href="/rairab/import"
            className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
          >
            📤 นำเข้าไฟล์
          </Link>
        </div>

        {/* Year selector */}
        <div className="flex gap-2 mb-4">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                year === y
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "bg-white text-gray-500 border border-emerald-100"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Platform filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {PLATFORM_OPTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                platform === p.id
                  ? `${p.color} text-white shadow-sm`
                  : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
        </div>

        {/* Total card */}
        <div className={`${pl.color} text-white rounded-2xl p-5 mb-4`}>
          <p className="text-sm opacity-80">
            {month ? `${MONTHS[month - 1]} ${year}` : `ทั้งปี ${year}`}
            {platform !== "all" ? ` · ${pl.label}` : ""}
          </p>
          {loading ? (
            <p className="text-3xl font-bold mt-1 opacity-60">กำลังโหลด...</p>
          ) : (
            <>
              <p className="text-3xl font-bold mt-1">
                ฿{(summary?.total ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-sm opacity-70 mt-1">{summary?.count ?? 0} คำสั่งซื้อ</p>
            </>
          )}
        </div>

        {/* Platform breakdown (only when "all" selected) */}
        {platform === "all" && summary && !loading && (
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 mb-4">
            <p className="text-xs text-gray-500 font-semibold mb-3">แยกตาม Platform</p>
            {PLATFORM_OPTIONS.filter((p) => p.id !== "all").map((p) => {
              const amt = summary.byPlatform[p.id] ?? 0;
              if (amt === 0) return null;
              const pct = summary.total > 0 ? (amt / summary.total) * 100 : 0;
              return (
                <div key={p.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 font-medium">{p.emoji} {p.label}</span>
                    <span className="text-gray-800 font-semibold">
                      ฿{amt.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${p.color} rounded-full transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 text-right">{pct.toFixed(1)}%</p>
                </div>
              );
            })}
            {Object.keys(summary.byPlatform).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-2">ยังไม่มีข้อมูล</p>
            )}
          </div>
        )}

        {/* Monthly bar chart */}
        {month === 0 && summary && !loading && (
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 mb-4">
            <p className="text-xs text-gray-500 font-semibold mb-3">รายได้รายเดือน {year}</p>
            <div className="flex items-end gap-1 h-24">
              {summary.byMonth.map((m, i) => {
                const h = maxMonthTotal > 0 ? (m.total / maxMonthTotal) * 100 : 0;
                const isCurrentMonth = year === CURRENT_YEAR && m.month === CURRENT_MONTH;
                return (
                  <button
                    key={i}
                    onClick={() => setMonth(m.month)}
                    className="flex-1 flex flex-col items-center gap-1 group"
                  >
                    <div className="w-full relative flex items-end justify-center" style={{ height: 80 }}>
                      <div
                        className={`w-full rounded-t-sm transition-all ${
                          isCurrentMonth ? "bg-emerald-400" : "bg-emerald-200 group-hover:bg-emerald-300"
                        }`}
                        style={{ height: `${Math.max(h, 4)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] ${isCurrentMonth ? "text-emerald-600 font-bold" : "text-gray-400"}`}>
                      {MONTHS[i]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">กดเดือนเพื่อดูรายละเอียด</p>
          </div>
        )}

        {/* Month filter pills (when a month is selected) */}
        {month !== 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setMonth(0)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-500"
              >
                ← ทั้งปี
              </button>
              {MONTHS.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setMonth(i + 1)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    month === i + 1
                      ? "bg-emerald-500 text-white"
                      : "bg-white border border-gray-200 text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && (summary?.count ?? 0) === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-emerald-100">
            <p className="text-3xl mb-2">📭</p>
            <p>ยังไม่มีรายรับในช่วงนี้</p>
            <p className="text-sm mt-1">กด "นำเข้าไฟล์" เพื่อเพิ่มข้อมูล</p>
          </div>
        )}

      </div>
    </main>
  );
}
