"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type Platform = "all" | "tiktok" | "shopee" | "lazada" | "manual";

type Summary = {
  total:      number;
  count:      number;
  byPlatform: Record<string, number>;
  byMonth:    { month: number; total: number }[];
};

type AdjustEntry = { id: string; amount: number; vendor: string; transaction_date: string };

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
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

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

    // Manual adjustments (year-wide, no platform filter)
    fetch(`/api/transactions?type=income&lineUserId=${lineUserId}&year=${year}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const manual = (d.transactions ?? []).filter((t: AdjustEntry & { source?: string }) => !t.source);
        setAdjusts(manual);
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
        const manual = (d.transactions ?? []).filter((t: AdjustEntry & { source?: string }) => !t.source);
        setAdjusts(manual);
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

  const maxMonthTotal = Math.max(...(summary?.byMonth.map((m) => m.total) ?? [1]), 1);
  const pl = PLATFORM_OPTIONS.find((p) => p.id === platform)!;

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
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
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd((v) => !v); setShowAdjust(false); setAddMsg(null); }}
              className="flex items-center gap-1 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              + เพิ่ม
            </button>
            <button onClick={() => { setShowAdjust((v) => !v); setShowAdd(false); setAdjMsg(null); }}
              className="flex items-center gap-1 bg-white border border-emerald-300 text-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              ✏️ ปรับยอด
            </button>
            <Link href="/rairab/import"
              className="flex items-center gap-1.5 bg-white border border-emerald-300 text-emerald-600 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all">
              📤 นำเข้า
            </Link>
          </div>
        </div>

        {/* ── Desktop 2-panel grid ─────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">

          {/* LEFT — Charts, filters, summary (2 cols) */}
          <div className="lg:col-span-2 space-y-4 mb-6 lg:mb-0">

            {/* Year selector */}
            <div className="flex gap-2">
              {YEARS.map((y) => (
                <button key={y} onClick={() => setYear(y)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
                    year === y ? "bg-emerald-500 text-white shadow-sm" : "bg-white text-gray-500 border border-emerald-100"
                  }`}>
                  {y}
                </button>
              ))}
            </div>

            {/* Platform filter */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {PLATFORM_OPTIONS.map((p) => (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    platform === p.id ? `${p.color} text-white shadow-sm` : "bg-white text-gray-500 border border-gray-200"
                  }`}>
                  {p.emoji} {p.label}
                </button>
              ))}
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
                        <span className="text-gray-600 font-medium">{p.emoji} {p.label}</span>
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
                <p className="text-3xl mb-2">📭</p>
                <p>ยังไม่มีรายรับในช่วงนี้</p>
                <p className="text-sm mt-1">กด "+ เพิ่ม" หรือ "นำเข้า" เพื่อเพิ่มข้อมูล</p>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
