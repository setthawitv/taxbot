"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconIncome, IconScan, IconPlus, IconPencil, IconUpload,
  IconAll, IconMusic, IconCart, IconBag, IconNote, IconInbox,
} from "@/components/icons";
import AppLayout from "@/components/AppLayout";

type Platform = "all" | "tiktok" | "shopee" | "lazada" | "manual";

const PLATFORM_ICONS: Record<Platform, React.ComponentType<{ className?: string }>> = {
  all:    IconAll,
  tiktok: IconMusic,
  shopee: IconCart,
  lazada: IconBag,
  manual: IconNote,
};

type Summary = {
  total:      number;
  count:      number;
  byPlatform: Record<string, number>;
  byMonth:    { month: number; total: number }[];
};

type AdjustEntry = { id: string; amount: number; vendor: string; transaction_date: string };

type TxnRow = {
  id: string;
  amount: number;
  vendor: string;
  description?: string;
  transaction_date: string;
  source?: string;
};

const PLATFORM_OPTIONS: { id: Platform; label: string; emoji: string; color: string }[] = [
  { id: "all",    label: "ทั้งหมด", emoji: "📊", color: "bg-emerald-500" },
  { id: "tiktok", label: "TikTok",  emoji: "🎵", color: "bg-gray-800"   },
  { id: "shopee", label: "Shopee",  emoji: "🛒", color: "bg-orange-500" },
  { id: "lazada", label: "Lazada",  emoji: "📦", color: "bg-blue-600"   },
  { id: "manual", label: "Manual",  emoji: "📝", color: "bg-purple-500" },
];

const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "#1f2937",
  shopee: "#f97316",
  lazada: "#2563eb",
  manual: "#8b5cf6",
};
const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok Shop",
  shopee: "Shopee",
  lazada: "Lazada",
  manual: "Manual",
};

function PlatformDonut({ byPlatform, total }: { byPlatform: Record<string, number>; total: number }) {
  const entries = Object.entries(byPlatform).filter(([, v]) => v > 0);
  const r = 36; const cx = 44; const cy = 44; const tau = 2 * Math.PI;
  let cursor = 0;
  const slices = entries.map(([key, val]) => {
    const frac = total > 0 ? val / total : 0;
    const start = cursor;
    cursor += frac;
    return { key, val, frac, start, end: cursor };
  });

  function arc(startFrac: number, endFrac: number, color: string) {
    const gap = 0.012;
    const s = (startFrac + gap / 2) * tau - Math.PI / 2;
    const e = (endFrac  - gap / 2) * tau - Math.PI / 2;
    if (e - s <= 0) return null;
    const large = endFrac - startFrac > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(s); const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e); const y2 = cy + r * Math.sin(e);
    return <path key={color} d={`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2}`}
      fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />;
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <svg viewBox="0 0 88 88" className="w-28 h-28">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
        </svg>
        <p className="text-xs text-gray-400">ยังไม่มีข้อมูล</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg viewBox="0 0 88 88" className="w-36 h-36">
          {slices.map((sl) => arc(sl.start, sl.end, PLATFORM_COLORS[sl.key] ?? "#9ca3af"))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-base font-bold text-[#0A192F]">Total</p>
          <p className="text-[10px] text-gray-400">{entries.length} Sources</p>
        </div>
      </div>
      <div className="w-full space-y-2">
        {slices.map((sl) => (
          <div key={sl.key} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PLATFORM_COLORS[sl.key] ?? "#9ca3af" }} />
            <span className="flex-1 text-xs text-gray-600">{PLATFORM_LABELS[sl.key] ?? sl.key}</span>
            <span className="text-xs font-bold text-gray-800">{(sl.frac * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RaiRab() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const [year,       setYear]       = useState(CURRENT_YEAR);
  const [month,      setMonth]      = useState(0);
  const [platform,   setPlatform]   = useState<Platform>("all");
  const [summary,    setSummary]    = useState<Summary | null>(null);
  const [loading,    setLoading]    = useState(true);

  // Add manual income modal
  const [showAdd,   setShowAdd]   = useState(false);
  const [addDate,   setAddDate]   = useState(new Date().toISOString().slice(0, 10));
  const [addAmt,    setAddAmt]    = useState("");
  const [addVendor, setAddVendor] = useState("");
  const [addDesc,   setAddDesc]   = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg,    setAddMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  // Adjust modal
  const [showAdjust,  setShowAdjust]  = useState(false);
  const [adjMonth,    setAdjMonth]    = useState(CURRENT_MONTH);
  const [adjDir,      setAdjDir]      = useState<"+" | "-">("+");
  const [adjAmount,   setAdjAmount]   = useState("");
  const [adjNote,     setAdjNote]     = useState("");
  const [adjSaving,   setAdjSaving]   = useState(false);
  const [adjMsg,      setAdjMsg]      = useState<{ ok: boolean; text: string } | null>(null);

  // Past adjustments list
  const [adjusts,    setAdjusts]    = useState<AdjustEntry[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Recent transactions for table
  const [recentTxns, setRecentTxns] = useState<TxnRow[]>([]);

  // Scan receipt
  const [showScan,    setShowScan]    = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanning,    setScanning]    = useState(false);
  const [scanError,   setScanError]   = useState("");
  const scanFileRef   = useRef<HTMLInputElement>(null);
  const scanCamRef    = useRef<HTMLInputElement>(null);

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

  // ── Load summary + adjustments ────────────────────────────────────────────
  useEffect(() => {
    if (!authReady || !lineUserId) {
      if (authReady) setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setLoading(true);

    // Summary
    const params = new URLSearchParams({ lineUserId, year: String(year), month: String(month), platform });
    fetch(`/api/income/summary?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSummary(d); })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); })
      .finally(() => setLoading(false));

    // All transactions (year-wide, no platform filter)
    fetch(`/api/transactions?type=income&lineUserId=${lineUserId}&year=${year}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const all: (AdjustEntry & { source?: string; description?: string })[] = d.transactions ?? [];
        const manual = all.filter((t) => !t.source);
        setAdjusts(manual);
        // Recent: latest 20, any source
        const sorted = [...all].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
        setRecentTxns(sorted.slice(0, 20));
      })
      .catch((e) => { if (e.name !== "AbortError") console.error(e); });

    return () => ctrl.abort();
  }, [authReady, lineUserId, year, month, platform]);

  // Helpers to refresh after save/delete
  function refreshSummary(uid: string) {
    const params = new URLSearchParams({ lineUserId: uid, year: String(year), month: String(month), platform });
    fetch(`/api/income/summary?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSummary(d); });
  }

  function loadAdjusts(uid: string) {
    fetch(`/api/transactions?type=income&lineUserId=${uid}&year=${year}`)
      .then((r) => r.json())
      .then((d) => {
        const all: (AdjustEntry & { source?: string; description?: string })[] = d.transactions ?? [];
        setAdjusts(all.filter((t) => !t.source));
        const sorted = [...all].sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
        setRecentTxns(sorted.slice(0, 20));
      });
  }

  // ── Save manual income ────────────────────────────────────────────────────
  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!lineUserId || !addAmt || !addVendor) return;
    setAddSaving(true); setAddMsg(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          type: "income",
          amount: parseFloat(addAmt),
          vendor: addVendor.trim(),
          description: addDesc.trim() || addVendor.trim(),
          date: addDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setAddMsg({ ok: true, text: `✅ บันทึกรายรับ ฿${parseFloat(addAmt).toLocaleString("th-TH")} แล้ว` });
      setAddAmt(""); setAddVendor(""); setAddDesc("");
      setAddDate(new Date().toISOString().slice(0, 10));
      setShowAdd(false);
      refreshSummary(lineUserId);
      loadAdjusts(lineUserId);
    } catch (err: unknown) {
      setAddMsg({ ok: false, text: `❌ ${err instanceof Error ? err.message : "เกิดข้อผิดพลาด"}` });
    } finally {
      setAddSaving(false);
    }
  }

  // ── Save adjustment ───────────────────────────────────────────────────────
  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!lineUserId || !adjAmount) return;
    setAdjSaving(true); setAdjMsg(null);

    const amt = parseFloat(adjAmount);
    const finalAmt = adjDir === "-" ? -amt : amt;
    const mo = String(adjMonth).padStart(2, "0");
    const date = `${year}-${mo}-15`; // mid-month
    const vendor = adjNote.trim() || (adjDir === "+" ? "ปรับยอดเพิ่ม" : "ปรับยอดลด");

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, type: "income", amount: finalAmt, vendor, description: vendor, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setAdjMsg({ ok: true, text: `✅ ปรับยอด ${adjDir}฿${amt.toLocaleString("th-TH")} เดือน ${MONTHS[adjMonth - 1]} แล้ว` });
      setAdjAmount(""); setAdjNote("");
      setShowAdjust(false);
      refreshSummary(lineUserId);
      loadAdjusts(lineUserId);
    } catch (err: unknown) {
      setAdjMsg({ ok: false, text: `❌ ${err instanceof Error ? err.message : "เกิดข้อผิดพลาด"}` });
    } finally {
      setAdjSaving(false);
    }
  }

  // ── Delete adjustment ─────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!lineUserId) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, lineUserId, table: "transactions" }),
      });
      if (!res.ok) throw new Error();
      setAdjusts((prev) => prev.filter((t) => t.id !== id));
      refreshSummary(lineUserId);
    } catch {
      setAdjMsg({ ok: false, text: "❌ ลบไม่สำเร็จ" });
    } finally {
      setDeletingId(null);
    }
  }

  function handleScanFile(file: File | null) {
    if (!file) return;
    setScanError("");
    const reader = new FileReader();
    reader.onload = (e) => setScanPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function runScan() {
    if (!scanPreview || !lineUserId) return;
    setScanning(true);
    setScanError("");
    try {
      const res = await fetch("/api/scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lineUserId, imageBase64: scanPreview, forceType: "income" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setAddVendor(data.receipt.vendor ?? "");
      setAddAmt(String(data.receipt.amount ?? ""));
      setAddDate(data.receipt.date ?? new Date().toISOString().slice(0, 10));
      setAddDesc(data.receipt.description ?? "");
      setShowScan(false);
      setScanPreview(null);
      setShowAdd(true);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanning(false);
    }
  }

  const maxMonthTotal = Math.max(...(summary?.byMonth.map((m) => m.total) ?? [1]), 1);
  const pl = PLATFORM_OPTIONS.find((p) => p.id === platform)!;

  return (
    <AppLayout title="รายรับ">
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/home" className="text-emerald-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <IconIncome />
            </div>
            <div>
              <h1 className="text-xl font-bold text-emerald-700">รายรับ</h1>
              <p className="text-emerald-500 text-sm">Income Dashboard</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button onClick={() => { setShowScan(true); setScanPreview(null); setScanError(""); }}
              className="flex items-center justify-center gap-1.5 bg-purple-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              <IconScan className="w-4 h-4" /> สแกน
            </button>
            <button onClick={() => { setShowAdd((v) => !v); setShowAdjust(false); setAddMsg(null); }}
              className="flex items-center justify-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              <IconPlus className="w-4 h-4" /> เพิ่ม
            </button>
            <button onClick={() => { setShowAdjust((v) => !v); setShowAdd(false); setAdjMsg(null); }}
              className="flex items-center justify-center gap-1.5 bg-white border border-emerald-300 text-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              <IconPencil className="w-4 h-4" /> ปรับยอด
            </button>
            <Link href="/rairab/import"
              className="flex items-center justify-center gap-1.5 bg-white border border-emerald-300 text-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              <IconUpload className="w-4 h-4" /> นำเข้า
            </Link>
          </div>
        </div>

        {/* ── Desktop 2-panel grid ─────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">

          {/* LEFT — Charts, filters, summary (2 cols) */}
          <div className="lg:col-span-2 space-y-4 mb-6 lg:mb-0">

            {/* Year + Month dropdowns */}
            <div className="flex gap-2">
              <select
                value={year}
                onChange={(e) => { setYear(Number(e.target.value)); setMonth(0); }}
                className="flex-1 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex-[2] bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                <option value={0}>ทุกเดือน</option>
                {MONTHS.map((label, i) => (
                  <option key={i} value={i + 1}>{label}</option>
                ))}
              </select>
            </div>

            {/* Platform filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PLATFORM_OPTIONS.map((p) => {
                const Ico = PLATFORM_ICONS[p.id];
                return (
                  <button key={p.id} onClick={() => setPlatform(p.id)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      platform === p.id ? `${p.color} text-white shadow-sm` : "bg-white text-gray-500 border border-gray-200"
                    }`}>
                    <Ico className="w-3.5 h-3.5" /> {p.label}
                  </button>
                );
              })}
            </div>

            {/* Total card */}
            <div className={`${pl.color} text-white rounded-2xl p-5`}>
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

            {/* Platform breakdown */}
            {platform === "all" && summary && !loading && (
              <div className="bg-white rounded-2xl border border-emerald-100 p-4">
                <p className="text-xs text-gray-500 font-semibold mb-3">แยกตาม Platform</p>
                {PLATFORM_OPTIONS.filter((p) => p.id !== "all").map((p) => {
                  const amt = summary.byPlatform[p.id] ?? 0;
                  if (amt === 0) return null;
                  const pct = summary.total > 0 ? (amt / summary.total) * 100 : 0;
                  return (
                    <div key={p.id} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium flex items-center gap-1.5">{(() => { const Ic = PLATFORM_ICONS[p.id]; return <Ic className="w-3.5 h-3.5" />; })()} {p.label}</span>
                        <span className="text-gray-800 font-semibold">฿{amt.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${p.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
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
              <div className="bg-white rounded-2xl border border-emerald-100 p-4">
                <p className="text-xs text-gray-500 font-semibold mb-3">รายได้รายเดือน {year}</p>
                <div className="flex items-end gap-1 h-32">
                  {summary.byMonth.map((m, i) => {
                    const h = maxMonthTotal > 0 ? (m.total / maxMonthTotal) * 100 : 0;
                    const isCurrentMonth = year === CURRENT_YEAR && m.month === CURRENT_MONTH;
                    return (
                      <button key={i} onClick={() => setMonth(m.month)} className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full relative flex items-end justify-center" style={{ height: 100 }}>
                          <div className={`w-full rounded-t-sm transition-all ${isCurrentMonth ? "bg-emerald-400" : "bg-emerald-200 group-hover:bg-emerald-300"}`}
                            style={{ height: `${Math.max(h, 4)}%` }} />
                        </div>
                        <span className={`text-[9px] ${isCurrentMonth ? "text-emerald-600 font-bold" : "text-gray-400"}`}>{MONTHS[i]}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">กดเดือนเพื่อดูรายละเอียด</p>
              </div>
            )}

            {/* Month filter pills */}
            {month !== 0 && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setMonth(0)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-500">
                  ← ทั้งปี
                </button>
                {MONTHS.map((label, i) => (
                  <button key={i} onClick={() => setMonth(i + 1)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      month === i + 1 ? "bg-emerald-500 text-white" : "bg-white border border-gray-200 text-gray-500"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Forms + Adjustments (1 col) */}
          <div className="space-y-4">

            {/* Add manual income form */}
            {showAdd && (
              <form onSubmit={handleAddIncome} className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">+ เพิ่มรายรับ</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">จำนวนเงิน (บาท) *</label>
                    <input value={addAmt} onChange={(e) => setAddAmt(e.target.value)}
                      type="number" min="0.01" step="0.01" placeholder="0.00" required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">วันที่ *</label>
                    <input value={addDate} onChange={(e) => setAddDate(e.target.value)}
                      type="date" required
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">แหล่งรายรับ *</label>
                  <input value={addVendor} onChange={(e) => setAddVendor(e.target.value)}
                    placeholder="เช่น ขายของออนไลน์, รับจ้าง" required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">รายละเอียด (ไม่บังคับ)</label>
                  <input value={addDesc} onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <button type="submit" disabled={addSaving || !addAmt || !addVendor}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {addSaving ? "กำลังบันทึก..." : "บันทึกรายรับ"}
                </button>
              </form>
            )}

            {addMsg && (
              <div className={`p-3 rounded-xl text-sm font-medium ${addMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {addMsg.text}
              </div>
            )}

            {/* Adjust form */}
            {showAdjust && (
              <form onSubmit={handleAdjust} className="bg-white rounded-2xl border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">✏️ ปรับยอดรายรับ</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">เดือนที่ต้องการปรับ</label>
                  <div className="flex flex-wrap gap-1.5">
                    {MONTHS.map((label, i) => (
                      <button key={i} type="button" onClick={() => setAdjMonth(i + 1)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                          adjMonth === i + 1 ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1.5 block">ประเภท</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAdjDir("+")}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        adjDir === "+" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                      + เพิ่มยอด
                    </button>
                    <button type="button" onClick={() => setAdjDir("-")}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        adjDir === "-" ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                      − ลดยอด
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">จำนวนเงิน (บาท) *</label>
                    <input value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}
                      type="number" min="0.01" step="0.01" placeholder="0.00"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">หมายเหตุ</label>
                    <input value={adjNote} onChange={(e) => setAdjNote(e.target.value)}
                      placeholder="เช่น คืนเงิน"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                </div>
                <button type="submit" disabled={adjSaving || !adjAmount}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {adjSaving ? "กำลังบันทึก..." : `${adjDir === "+" ? "เพิ่ม" : "ลด"} ยอดเดือน ${MONTHS[adjMonth - 1]}`}
                </button>
              </form>
            )}

            {adjMsg && (
              <div className={`p-3 rounded-xl text-sm font-medium ${adjMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {adjMsg.text}
              </div>
            )}

            {/* Manual adjustments list */}
            {adjusts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">รายการปรับยอด</p>
                <ul className="flex flex-col gap-2">
                  {adjusts.map((t) => {
                    const isPlus = Number(t.amount) >= 0;
                    return (
                      <li key={t.id} className="bg-white rounded-2xl px-4 py-3 border border-emerald-100 flex items-center gap-3 hover:shadow-sm transition-shadow">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${isPlus ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"}`}>
                          {isPlus ? "+" : "−"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 truncate">{t.vendor}</p>
                          <p className="text-xs text-gray-400">{t.transaction_date}</p>
                        </div>
                        <p className={`font-semibold text-sm flex-shrink-0 ${isPlus ? "text-emerald-600" : "text-rose-500"}`}>
                          {isPlus ? "+" : ""}฿{Math.abs(Number(t.amount)).toLocaleString("th-TH")}
                        </p>
                        <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                          className="text-gray-300 hover:text-rose-400 text-xl leading-none transition-colors flex-shrink-0 disabled:opacity-40">
                          {deletingId === t.id ? "⏳" : "×"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Empty state */}
            {!loading && (summary?.count ?? 0) === 0 && adjusts.length === 0 && !showAdd && !showAdjust && (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-emerald-100">
                <div className="flex justify-center mb-2 text-emerald-300"><IconInbox className="w-10 h-10" /></div>
                <p>ยังไม่มีรายรับในช่วงนี้</p>
                <p className="text-sm mt-1">กด "+ เพิ่ม" หรือ "นำเข้า" เพื่อเพิ่มข้อมูล</p>
              </div>
            )}

          </div>
        </div>

        {/* ── Recent transactions + Platform donut ─────────────────────────── */}
        {(recentTxns.length > 0 || (summary && Object.keys(summary.byPlatform).length > 0)) && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Recent transactions table */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-bold text-[#0A192F]">รายการรายรับล่าสุด</p>
                <span className="text-xs text-gray-400">ทั้งหมด {recentTxns.length} รายการ</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 font-semibold uppercase tracking-wide">
                      <th className="text-left px-5 py-2.5">วันที่ / เวลา</th>
                      <th className="text-left px-3 py-2.5">รายละเอียดรายการ</th>
                      <th className="text-left px-3 py-2.5 hidden sm:table-cell">แพลตฟอร์ม</th>
                      <th className="text-right px-3 py-2.5">จำนวนเงิน</th>
                      <th className="text-left px-3 py-2.5 hidden md:table-cell">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recentTxns.map((t) => {
                      const src = t.source ?? "manual";
                      const color = PLATFORM_COLORS[src] ?? "#8b5cf6";
                      const label = PLATFORM_LABELS[src] ?? src;
                      const positive = Number(t.amount) >= 0;
                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 whitespace-nowrap text-gray-500">
                            {t.transaction_date}
                          </td>
                          <td className="px-3 py-3 min-w-[140px]">
                            <p className="font-semibold text-[#0A192F] truncate max-w-[180px]">{t.vendor || t.description || "—"}</p>
                            {t.description && t.description !== t.vendor && (
                              <p className="text-gray-400 truncate max-w-[180px]">{t.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 hidden sm:table-cell">
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
                              style={{ background: color }}>{label}</span>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            <span className={`font-bold ${positive ? "text-[#0A192F]" : "text-rose-500"}`}>
                              {positive ? "" : "-"}฿{Math.abs(Number(t.amount)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </span>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell">
                            {positive ? (
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />ตรวจสอบแล้ว
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-rose-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />รอดำเนินการ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Platform donut */}
            {summary && Object.keys(summary.byPlatform).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-bold text-[#0A192F] mb-4">สัดส่วนแพลตฟอร์ม</p>
                <PlatformDonut byPlatform={summary.byPlatform} total={summary.total} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scan modal ──────────────────────────────────────────────────────── */}
      {showScan && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">📸 สแกนใบเสร็จรายรับ</h2>
              <button onClick={() => { setShowScan(false); setScanPreview(null); setScanError(""); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {!scanPreview ? (
              <div className="space-y-3">
                <button onClick={() => scanCamRef.current?.click()}
                  className="w-full flex items-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
                  <span className="text-2xl ml-3">📷</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">ถ่ายรูป</p>
                    <p className="text-xs text-gray-400">เปิดกล้อง</p>
                  </div>
                </button>
                <input ref={scanCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => handleScanFile(e.target.files?.[0] ?? null)} />

                <button onClick={() => scanFileRef.current?.click()}
                  className="w-full flex items-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
                  <span className="text-2xl ml-3">🖼️</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">เลือกจากคลัง</p>
                    <p className="text-xs text-gray-400">JPG, PNG</p>
                  </div>
                </button>
                <input ref={scanFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleScanFile(e.target.files?.[0] ?? null)} />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={scanPreview} alt="receipt" className="w-full max-h-52 object-contain" />
                  <button onClick={() => setScanPreview(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">×</button>
                </div>
                {scanError && <p className="text-red-500 text-xs">❌ {scanError}</p>}
                <button onClick={runScan} disabled={scanning}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors">
                  {scanning ? "⏳ AI กำลังอ่าน..." : "🤖 สแกนด้วย AI"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
    </AppLayout>
  );
}
