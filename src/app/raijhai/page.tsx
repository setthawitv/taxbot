"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { IconExpense, IconScan, IconPlus, IconInbox } from "@/components/icons";
import AppLayout from "@/components/AppLayout";

const EXPENSE_CATEGORIES = [
  "ค่าสินค้า", "ค่าขนส่ง", "ค่าแพ็คเกจ", "ค่าโฆษณา",
  "ค่าอุปกรณ์", "ค่าเช่า", "ค่าสาธารณูปโภค", "อื่นๆ",
];

const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

type Transaction = {
  id: string;
  amount: number;
  vendor: string;
  description: string;
  transaction_date: string;
  staff_name?: string;
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RaiJhai() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);

  const [year,  setYear]  = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);

  // Form state (used for both add and edit)
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null); // null = new
  const [vendor,     setVendor]     = useState("");
  const [amount,     setAmount]     = useState("");
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [desc,       setDesc]       = useState("");
  const [category,   setCategory]   = useState("อื่นๆ");
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Scan receipt
  const [showScan,           setShowScan]           = useState(false);
  const [scanPreview,        setScanPreview]        = useState<string | null>(null);
  const [scanning,           setScanning]           = useState(false);
  const [scanError,          setScanError]          = useState("");
  const [scannedImageBase64, setScannedImageBase64] = useState<string | null>(null); // persists for upload
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

  // ── Load transactions ─────────────────────────────────────────────────────
  function loadTxns(uid: string) {
    setLoading(true);
    const params = new URLSearchParams({
      type: "expense",
      lineUserId: uid,
      year:  String(year),
      month: String(month),
    });
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const txns = data.transactions ?? [];
        setTransactions(txns);
        setTotal(txns.reduce((s: number, t: Transaction) => s + Number(t.amount), 0));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!authReady) return;
    if (lineUserId) loadTxns(lineUserId);
    else setLoading(false);
  }, [authReady, lineUserId, year, month]);

  // ── Open form for add ─────────────────────────────────────────────────────
  function openAddForm() {
    setEditId(null);
    setVendor(""); setAmount(""); setDesc(""); setCategory("อื่นๆ");
    setDate(new Date().toISOString().slice(0, 10));
    setScannedImageBase64(null);
    setSaveMsg(null);
    setShowForm(true);
  }

  // ── Open form for edit ────────────────────────────────────────────────────
  function openEditForm(t: Transaction) {
    setEditId(t.id);
    setVendor(t.vendor);
    setAmount(String(t.amount));
    setDesc(t.description);
    setDate(t.transaction_date);
    setCategory("อื่นๆ");
    setSaveMsg(null);
    setShowForm(true);
  }

  // ── Save (add or edit) ────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lineUserId || !vendor.trim() || !amount) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      let res: Response;
      if (editId) {
        // PATCH — edit existing
        res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, lineUserId, amount: parseFloat(amount), vendor: vendor.trim(), description: desc.trim(), date }),
        });
      } else {
        // POST — new
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId,
            amount:           parseFloat(amount),
            vendor:           vendor.trim(),
            description:      desc.trim(),
            date,
            expenseCategory:  category,
            source:           scannedImageBase64 ? "slip_photo" : "manual",
            imageBase64:      scannedImageBase64 ?? undefined,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      let msg = "✅ บันทึกแล้ว";
      if (!editId) {
        if (data.driveSynced)       msg = "✅ บันทึกแล้ว · ซิงค์ Sheets · อัปโหลด PDF ไป Drive แล้ว";
        else if (data.sheetSynced)  msg = "✅ บันทึกแล้ว · ซิงค์ Sheets แล้ว";
        else if (data.sheetError || data.driveError) {
          const detail = data.sheetError || data.driveError || "";
          msg = `⚠️ บันทึกแล้ว แต่ sync ไม่ได้ (${detail})`;
        }
      } else {
        msg = "✅ แก้ไขแล้ว";
      }
      setSaveMsg({ ok: !editId && (data.sheetError || data.driveError) ? false : true, text: msg });
      setShowForm(false);
      setEditId(null);
      setScannedImageBase64(null);
      loadTxns(lineUserId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setSaveMsg({ ok: false, text: `❌ ${msg}` });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!lineUserId) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, lineUserId, table: "transactions" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ลบไม่สำเร็จ");
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => {
        const t = transactions.find((t) => t.id === id);
        return t ? prev - Number(t.amount) : prev;
      });
      if (data.sheetDeleted === false) {
        setSaveMsg({ ok: false, text: "⚠️ ลบแล้ว แต่ลบใน Sheets ไม่ได้ — ลองเชื่อมต่อ Google ใหม่ใน Settings" });
      }
    } catch (err: unknown) {
      setSaveMsg({ ok: false, text: `❌ ${err instanceof Error ? err.message : "ลบไม่สำเร็จ"}` });
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
        body:    JSON.stringify({ lineUserId, imageBase64: scanPreview, forceType: "expense" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      // Pre-fill form with scan result; keep image for Drive upload
      setVendor(data.receipt.vendor ?? "");
      setAmount(String(data.receipt.amount ?? ""));
      setDate(data.receipt.date ?? new Date().toISOString().slice(0, 10));
      setDesc(data.receipt.description ?? "");
      setCategory(data.receipt.expenseCategory ?? "อื่นๆ");
      setScannedImageBase64(scanPreview); // keep for Drive รวมหลักฐาน upload
      setEditId(null);
      setShowScan(false);
      setScanPreview(null);
      setShowForm(true);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanning(false);
    }
  }

  return (
    <AppLayout title="รายจ่าย">
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/home" className="text-rose-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <IconExpense />
            </div>
            <div>
              <h1 className="text-xl font-bold text-rose-700">รายจ่าย</h1>
              <p className="text-rose-500 text-sm">Expense</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowScan(true); setScanPreview(null); setScanError(""); }}
              className="flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors"
            >
              <IconScan className="w-4 h-4" /> สแกน
            </button>
            <button
              onClick={showForm ? () => { setShowForm(false); setEditId(null); setSaveMsg(null); } : openAddForm}
              className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              {showForm ? "ยกเลิก" : <><IconPlus className="w-4 h-4" /> เพิ่ม</>}
            </button>
          </div>
        </div>

        {/* ── Desktop 2-panel grid ─────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:items-start">

          {/* LEFT — Filters + Summary + Form */}
          <div className="lg:col-span-2 space-y-4 mb-6 lg:mb-0">

            {/* Year + Month dropdowns */}
            <div className="flex gap-2">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="flex-1 bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="flex-[2] bg-white border border-rose-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
              >
                <option value={0}>ทั้งปี</option>
                {MONTHS.map((label, i) => (
                  <option key={i} value={i + 1}>{label}</option>
                ))}
              </select>
            </div>

            {/* Total card */}
            <div className="bg-rose-500 text-white rounded-2xl p-5">
              <p className="text-sm opacity-80">
                {month === 0 ? `รายจ่ายทั้งปี ${year}` : `${MONTHS[month - 1]} ${year}`}
              </p>
              <p className="text-3xl font-bold mt-1">฿{fmt(total)}</p>
              {!loading && <p className="text-sm opacity-70 mt-1">{transactions.length} รายการ</p>}
            </div>

            {/* Save feedback */}
            {saveMsg && (
              <div className={`p-3 rounded-xl text-sm font-medium ${saveMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {saveMsg.text}
              </div>
            )}

            {/* Add / Edit form */}
            {showForm && (
              <form onSubmit={handleSave} className="bg-white rounded-2xl border border-rose-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700 mb-1">
                  {editId ? "✏️ แก้ไขรายจ่าย" : "บันทึกรายจ่ายใหม่"}
                </p>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">ร้านค้า / ผู้รับเงิน *</label>
                  <input value={vendor} onChange={(e) => setVendor(e.target.value)}
                    placeholder="เช่น Kerry, Lazada, ไฟฟ้า"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">จำนวนเงิน (บาท) *</label>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)}
                      type="number" min="0" step="0.01" placeholder="0.00"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">วันที่</label>
                    <input value={date} onChange={(e) => setDate(e.target.value)}
                      type="date"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">รายละเอียด</label>
                  <input value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </div>

                {!editId && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่</label>
                    <div className="flex flex-wrap gap-2">
                      {EXPENSE_CATEGORIES.map((c) => (
                        <button key={c} type="button" onClick={() => setCategory(c)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            category === c ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600 border border-rose-200"
                          }`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button type="submit" disabled={saving || !vendor.trim() || !amount}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
                  {saving ? "กำลังบันทึก..." : editId ? "💾 บันทึกการแก้ไข" : "💾 บันทึกรายจ่าย"}
                </button>
              </form>
            )}
          </div>

          {/* RIGHT — Transaction list */}
          <div className="lg:col-span-3">
            {loading ? (
              <p className="text-center text-gray-400 py-10">กำลังโหลด...</p>
            ) : transactions.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-rose-100">
                <div className="flex justify-center mb-2 text-rose-300"><IconInbox className="w-10 h-10" /></div>
                <p>ไม่มีรายจ่ายในช่วงนี้</p>
                <p className="text-sm mt-1">กด + เพิ่มรายจ่าย</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {transactions.map((t) => (
                  <li key={t.id} className="bg-white rounded-2xl p-4 border border-rose-100 flex items-center gap-3 hover:shadow-sm transition-shadow">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0">
                      <IconExpense className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{t.vendor}</p>
                      <p className="text-xs text-gray-400 truncate">{t.description}</p>
                      <p className="text-xs text-gray-300">
                        {t.transaction_date}
                        {t.staff_name && <span className="ml-1.5 text-purple-400">· 👤 {t.staff_name}</span>}
                      </p>
                    </div>
                    <p className="text-rose-600 font-semibold flex-shrink-0 text-sm">
                      -฿{Number(t.amount).toLocaleString("th-TH")}
                    </p>
                    <button onClick={() => openEditForm(t)}
                      className="text-gray-300 hover:text-blue-400 text-base transition-colors flex-shrink-0"
                      title="แก้ไข">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}
                      className="text-gray-300 hover:text-rose-400 text-xl leading-none transition-colors flex-shrink-0 disabled:opacity-40"
                      title="ลบ">
                      {deletingId === t.id ? "⏳" : "×"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

        </div>
      </div>

      {/* ── Scan modal ──────────────────────────────────────────────────────── */}
      {showScan && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">📸 สแกนใบเสร็จรายจ่าย</h2>
              <button onClick={() => { setShowScan(false); setScanPreview(null); setScanError(""); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {!scanPreview ? (
              <div className="space-y-3">
                <label htmlFor="raijhai-scan-cam"
                  className="w-full flex items-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer">
                  <span className="text-2xl ml-3">📷</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">ถ่ายรูป</p>
                    <p className="text-xs text-gray-400">เปิดกล้อง</p>
                  </div>
                </label>
                <input id="raijhai-scan-cam" ref={scanCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => handleScanFile(e.target.files?.[0] ?? null)} />

                <label htmlFor="raijhai-scan-file"
                  className="w-full flex items-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer">
                  <span className="text-2xl ml-3">🖼️</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">เลือกจากคลัง</p>
                    <p className="text-xs text-gray-400">JPG, PNG</p>
                  </div>
                </label>
                <input id="raijhai-scan-file" ref={scanFileRef} type="file" accept="image/*" className="hidden"
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
                  className="w-full py-3 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-40 transition-colors">
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
