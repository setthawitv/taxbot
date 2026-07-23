"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ThaiDateInput from "@/components/ThaiDateInput";
import { useSession } from "next-auth/react";
import { IconExpense, IconScan, IconPlus, IconInbox } from "@/components/icons";
import AppLayout from "@/components/AppLayout";
import DateRangePicker, { presetRange, type DateRange } from "@/components/DateRangePicker";
import CameraCapture from "@/components/CameraCapture";
import { lsGet, lsSet } from "@/lib/storage";

const EXPENSE_CATEGORIES = [
  "ค่าสินค้า", "ค่าขนส่ง", "ค่าแพ็คเกจ", "ค่าโฆษณา",
  "ค่าอุปกรณ์", "ค่าเช่า", "ค่าสาธารณูปโภค", "อื่นๆ",
];

// Withholding-tax types & rates (อ้างอิง ttb: ภาษีหัก ณ ที่จ่าย)
// https://www.ttbbank.com/th/fin-tips/detail/pl-withholding-tax
const WHT_TYPES: { key: string; label: string; rate: number }[] = [
  { key: "none",         label: "ไม่มีภาษีหัก ณ ที่จ่าย", rate: 0    },
  { key: "transport",    label: "ค่าขนส่ง (1%)",           rate: 0.01 },
  { key: "ads",          label: "ค่าโฆษณา (2%)",           rate: 0.02 },
  { key: "service",      label: "ค่าบริการ / รับจ้างทำของ (3%)", rate: 0.03 },
  { key: "professional", label: "ค่าวิชาชีพอิสระ (3%)",     rate: 0.03 },
  { key: "rent",         label: "ค่าเช่าอสังหาฯ (5%)",      rate: 0.05 },
  { key: "dividend",     label: "เงินปันผล (10%)",          rate: 0.10 },
  { key: "interest",     label: "ดอกเบี้ย (15%)",           rate: 0.15 },
];
const VAT_RATE = 0.07;
const round2 = (n: number) => Math.round(n * 100) / 100;
// Guess a sensible WHT type from the expense category (used for auto-fill)
function whtTypeForCategory(cat: string): string {
  if (cat === "ค่าขนส่ง")   return "transport";
  if (cat === "ค่าโฆษณา")   return "ads";
  if (cat === "ค่าเช่า")     return "rent";
  return "none";
}

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
  vat_amount?: number;
  withholding_tax?: number;
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RaiJhai() {
  const [userId, setUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);

  const [range, setRange] = useState<DateRange>(() => {
    if (typeof window === "undefined") return presetRange("thisMonth");
    try { const s = lsGet("expense_range"); if (s) { const r = JSON.parse(s); if (r?.from && r?.to) return r as DateRange; } } catch { /* ignore */ }
    return presetRange("thisMonth");
  });
  function pickRange(r: DateRange) { setRange(r); lsSet("expense_range", JSON.stringify(r)); }

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
  const [customCategory, setCustomCategory] = useState(""); // free-text when "อื่นๆ" is picked
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  // Tax (VAT / WHT). Auto-derived from amount unless the user turns on manual edit.
  const [vatOn,      setVatOn]      = useState(false);       // include 7% VAT
  const [whtType,    setWhtType]    = useState("none");      // WHT category → rate
  const [vatManual,  setVatManual]  = useState("0.00");      // VAT amount when editing by hand
  const [whtManual,  setWhtManual]  = useState("0.00");      // WHT amount when editing by hand
  const [manualTax,  setManualTax]  = useState(false);       // edit VAT/WHT by hand
  const [showTaxWarn, setShowTaxWarn] = useState(false);     // warn before enabling manual
  const [warnAck,     setWarnAck]     = useState(false);     // "don't show again" checkbox

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null); // id pending delete confirmation

  // Scan receipt
  const [showScan,           setShowScan]           = useState(false);
  const [scanPreview,        setScanPreview]        = useState<string | null>(null);
  const [scanning,           setScanning]           = useState(false);
  const [scanError,          setScanError]          = useState("");
  const [scannedImageBase64, setScannedImageBase64] = useState<string | null>(null); // persists for upload
  const [showCamera,         setShowCamera]         = useState(false);
  const scanFileRef   = useRef<HTMLInputElement>(null);

  const { data: session, status: sessionStatus } = useSession();

  // ── Resolve user ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolveUser() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) { const d = await res.json(); if (d.userId) setUserId(d.userId); }
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
      userId: uid,
      from: range.from,
      to:   range.to,
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
    if (userId) loadTxns(userId);
    else setLoading(false);
  }, [authReady, userId, range.from, range.to]);


  // ── Open form for add ─────────────────────────────────────────────────────
  function openAddForm() {
    setEditId(null);
    setVendor(""); setAmount(""); setDesc(""); setCategory("อื่นๆ"); setCustomCategory("");
    setDate(new Date().toISOString().slice(0, 10));
    setScannedImageBase64(null);
    setVatOn(false); setWhtType("none"); setVatManual("0.00"); setWhtManual("0.00"); setManualTax(false);
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
    // Load saved tax values; if any exist, open in manual mode so they're preserved
    const vatVal = Number(t.vat_amount) || 0;
    const whtVal = Number(t.withholding_tax) || 0;
    setVatManual(vatVal.toFixed(2));
    setWhtManual(whtVal.toFixed(2));
    setVatOn(vatVal > 0);
    setWhtType("none");
    setManualTax(vatVal > 0 || whtVal > 0);
    setSaveMsg(null);
    setShowForm(true);
  }

  // ── Manual tax edit: seed fields from the current auto values, then unlock ──
  function enableManualTax() {
    const g    = parseFloat(amount) || 0;
    const vAuto = vatOn ? round2(g - g / (1 + VAT_RATE)) : 0;
    const rate  = WHT_TYPES.find((w) => w.key === whtType)?.rate ?? 0;
    const wAuto = round2((g - vAuto) * rate);
    setVatManual(vAuto.toFixed(2));
    setWhtManual(wAuto.toFixed(2));
    setManualTax(true);
  }

  // Toggle handler — warn the first time (unless the user opted out)
  function onToggleManual(checked: boolean) {
    if (!checked) { setManualTax(false); return; }
    if (lsGet("vendee_tax_manual_ack") === "1") { enableManualTax(); return; }
    setWarnAck(false);
    setShowTaxWarn(true);
  }

  function confirmManualEdit() {
    if (warnAck) lsSet("vendee_tax_manual_ack", "1");
    enableManualTax();
    setShowTaxWarn(false);
  }

  // ── Save (add or edit) ────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !vendor.trim() || !amount) return;
    setSaving(true);
    setSaveMsg(null);

    // Re-derive effective VAT/WHT (same rule as the render summary).
    // Entered amount = GROSS total; VAT is extracted from it, WHT is on the net base.
    const grossAmt       = parseFloat(amount) || 0;
    const rate           = WHT_TYPES.find((w) => w.key === whtType)?.rate ?? 0;
    const vatAmount      = manualTax ? Math.max(0, parseFloat(vatManual) || 0) : (vatOn ? round2(grossAmt - grossAmt / (1 + VAT_RATE)) : 0);
    const netBase        = round2(grossAmt - vatAmount);
    const withholdingTax = manualTax ? Math.max(0, parseFloat(whtManual) || 0) : round2(netBase * rate);

    try {
      let res: Response;
      if (editId) {
        // PATCH — edit existing
        res = await fetch("/api/transactions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, userId, amount: parseFloat(amount), vendor: vendor.trim(), description: desc.trim(), date, vatAmount, withholdingTax }),
        });
      } else {
        // POST — new
        res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            amount:           parseFloat(amount),
            vendor:           vendor.trim(),
            description:      desc.trim(),
            date,
            expenseCategory:  category === "อื่นๆ" && customCategory.trim() ? customCategory.trim() : category,
            vatAmount,
            withholdingTax,
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
          const detail = String(data.sheetError || data.driveError || "");
          // A scopes/auth error means the Google connection needs re-granting.
          msg = /scope|auth|token|permission|insufficient/i.test(detail)
            ? "⚠️ บันทึกแล้ว แต่ซิงค์ Google ไม่ได้ — โปรดเชื่อมต่อ Google ใหม่ที่หน้า ตั้งค่า"
            : `⚠️ บันทึกแล้ว แต่ซิงค์ Google ไม่ได้ (${detail})`;
        }
      } else {
        msg = "✅ แก้ไขแล้ว";
      }
      setSaveMsg({ ok: !editId && (data.sheetError || data.driveError) ? false : true, text: msg });
      setShowForm(false);
      setEditId(null);
      setScannedImageBase64(null);
      loadTxns(userId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setSaveMsg({ ok: false, text: `❌ ${msg}` });
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!userId) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, userId, table: "transactions" }),
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
    if (!scanPreview || !userId) return;
    setScanning(true);
    setScanError("");
    try {
      const res = await fetch("/api/scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, imageBase64: scanPreview, forceType: "expense" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      // Pre-fill form with scan result; keep image for Drive upload
      setVendor(data.receipt.vendor ?? "");
      setAmount(String(data.receipt.amount ?? ""));
      setDate(data.receipt.date ?? new Date().toISOString().slice(0, 10));
      setDesc(data.receipt.description ?? "");
      const scanCat = data.receipt.expenseCategory ?? "อื่นๆ";
      setCategory(scanCat);
      // Tax: use scanned VAT/WHT if present (manual), else auto-fill from category
      const scanVat = Number(data.receipt.vatAmount)     || 0;
      const scanWht = Number(data.receipt.withholdingTax) || 0;
      if (scanVat > 0 || scanWht > 0) {
        setManualTax(true);
        setVatManual(scanVat.toFixed(2));
        setWhtManual(scanWht.toFixed(2));
        setVatOn(scanVat > 0);
        setWhtType("none");
      } else {
        setManualTax(false);
        setVatOn(false);
        setWhtType(whtTypeForCategory(scanCat));
      }
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

  // Tax breakdown for the form summary — derived during render (no effect).
  // The entered amount is the GROSS total (VAT already included when vatOn).
  const gross     = parseFloat(amount) || 0;
  const whtRate   = WHT_TYPES.find((w) => w.key === whtType)?.rate ?? 0;
  const vatAuto   = vatOn ? round2(gross - gross / (1 + VAT_RATE)) : 0; // VAT ถอดออกจากยอดรวม
  const vatNum    = manualTax ? Math.max(0, parseFloat(vatManual) || 0) : vatAuto;
  const baseNet   = round2(gross - vatNum);                            // เงินต้นก่อน VAT
  const whtAuto   = round2(baseNet * whtRate);                         // WHT คิดจากเงินต้น
  const whtNum    = manualTax ? Math.max(0, parseFloat(whtManual) || 0) : whtAuto;
  const netPaid   = round2(gross - whtNum);                            // ยอดจ่ายจริงให้ผู้ขาย

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

            {/* Date range */}
            <DateRangePicker value={range} onChange={pickRange} className="w-full" />

            {/* Total card */}
            <div className="bg-rose-500 text-white rounded-2xl p-5">
              <p className="text-sm opacity-80">รายจ่ายช่วงที่เลือก</p>
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
                      type="number" min="0" step="0.01" placeholder="0.00" onWheel={(e) => e.currentTarget.blur()}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">วันที่</label>
                    <ThaiDateInput value={date} onChange={setDate}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 mb-1 block">รายละเอียด</label>
                  <input value={desc} onChange={(e) => setDesc(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม (ไม่บังคับ)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </div>

                {/* ── VAT / WHT ─────────────────────────────────────────── */}
                <div className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">ภาษี (VAT / หัก ณ ที่จ่าย)</p>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <span className="text-xs text-gray-500">แก้ไขยอดเอง</span>
                      <input type="checkbox" checked={manualTax}
                        onChange={(e) => onToggleManual(e.target.checked)}
                        className="w-4 h-4 accent-rose-500" />
                    </label>
                  </div>

                  {/* Auto-fill controls (hidden when editing manually) */}
                  {!manualTax && (
                    <div className="space-y-2.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={vatOn}
                          onChange={(e) => setVatOn(e.target.checked)}
                          className="w-4 h-4 accent-rose-500" />
                        <span className="text-sm text-gray-600">มีภาษีมูลค่าเพิ่ม (VAT 7%)</span>
                      </label>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">ประเภทภาษีหัก ณ ที่จ่าย</label>
                        <select value={whtType} onChange={(e) => setWhtType(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-200">
                          {WHT_TYPES.map((w) => <option key={w.key} value={w.key}>{w.label}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Manual amount inputs */}
                  {manualTax && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">VAT (บาท)</label>
                        <input value={vatManual} onChange={(e) => setVatManual(e.target.value)}
                          type="number" min="0" step="0.01" placeholder="0.00" onWheel={(e) => e.currentTarget.blur()}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">หัก ณ ที่จ่าย (บาท)</label>
                        <input value={whtManual} onChange={(e) => setWhtManual(e.target.value)}
                          type="number" min="0" step="0.01" placeholder="0.00" onWheel={(e) => e.currentTarget.blur()}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
                      </div>
                    </div>
                  )}

                  {/* Summary — entered amount is the gross total (incl VAT) */}
                  <div className="border-t border-gray-200 pt-2.5 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>ยอดรวม{vatNum > 0 ? " (รวม VAT)" : ""}</span><span>฿{fmt(gross)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>เงินต้นก่อน VAT</span><span>฿{fmt(baseNet)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>VAT 7% (รวมในยอด)</span><span>฿{fmt(vatNum)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>หัก ณ ที่จ่าย</span><span>-฿{fmt(whtNum)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1.5">
                      <span>ยอดจ่ายให้ผู้ขาย</span><span>฿{fmt(netPaid)}</span>
                    </div>
                  </div>
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
                    {category === "อื่นๆ" && (
                      <input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="ระบุหมวดหมู่เอง (เช่น ค่าคอมมิชชั่น, ค่าที่ปรึกษา)"
                        className="mt-2 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                      />
                    )}
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
                    <button onClick={() => setConfirmDelete(t.id)} disabled={deletingId === t.id}
                      className="text-gray-300 hover:text-rose-500 text-lg leading-none transition-colors flex-shrink-0 disabled:opacity-40"
                      title="ลบ">
                      {deletingId === t.id ? "⏳" : "🗑️"}
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
                <button type="button" onClick={() => setShowCamera(true)}
                  className="w-full flex items-center gap-3 py-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-rose-300 hover:bg-rose-50 transition-colors cursor-pointer">
                  <span className="text-2xl ml-3">📷</span>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-700">ถ่ายรูป</p>
                    <p className="text-xs text-gray-400">เปิดกล้อง</p>
                  </div>
                </button>

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

      {/* ── Live camera capture ─────────────────────────────────────────────── */}
      {showCamera && (
        <CameraCapture
          onCapture={(dataUrl) => { setScanPreview(dataUrl); setShowCamera(false); }}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* ── Confirm delete ──────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"
          onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-4xl mb-2">🗑️</div>
            <p className="font-bold text-gray-800">ลบรายจ่ายนี้?</p>
            <p className="text-sm text-gray-500 mt-1">การลบไม่สามารถกู้คืนได้ (ลบไฟล์ใน Drive ด้วย)</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50">
                ยกเลิก
              </button>
              <button onClick={() => { const id = confirmDelete; setConfirmDelete(null); if (id) handleDelete(id); }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Warn before enabling manual tax edit ────────────────────────────── */}
      {showTaxWarn && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[88vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center flex-shrink-0 text-xl">⚠️</div>
              <h2 className="font-bold text-gray-800 text-lg flex-1 leading-snug">ข้อควรระวังก่อนแก้ไขยอดเอง</h2>
              <button onClick={() => setShowTaxWarn(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Before → After */}
            <div className="flex items-center gap-2">
              {[{ title: "ตอนนี้ (คำนวณอัตโนมัติ)", locked: true }, { title: "หลังกดแก้ไข (พิมพ์เอง)", locked: false }].map((c, idx) => (
                <div key={idx} className="contents">
                  <div className="flex-1 border border-gray-200 rounded-xl p-2.5 space-y-1.5">
                    <p className="text-[11px] font-semibold text-gray-500 leading-tight">{c.title}</p>
                    {[{ l: "VAT", v: vatNum }, { l: "หัก ณ ที่จ่าย", v: whtNum }].map((f) => (
                      <div key={f.l}>
                        <p className="text-[10px] text-gray-400">{f.l}</p>
                        <div className={`rounded-lg px-2 py-1.5 text-xs font-medium ${c.locked ? "bg-gray-100 text-gray-400" : "bg-white border border-rose-200 text-gray-700"}`}>
                          ฿{fmt(f.v)}
                        </div>
                      </div>
                    ))}
                  </div>
                  {idx === 0 && <span className="text-rose-400 text-lg flex-shrink-0">→</span>}
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              หากกดแก้ไขยอด ช่อง VAT และหัก ณ ที่จ่าย จะเปลี่ยนเป็นพิมพ์เองได้
              โดยระบบ<strong>จะไม่คำนวณให้อัตโนมัติ</strong> ซึ่งอาจทำให้ยอดคลาดเคลื่อนได้
            </p>

            <div className="bg-blue-50 rounded-xl p-3 text-sm text-gray-600 flex gap-2.5">
              <span className="text-base">✏️</span>
              <div>
                <p className="font-semibold text-gray-700 mb-1">สิ่งที่แก้ไขได้:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>ยอด VAT และ ภาษีหัก ณ ที่จ่าย (WHT)</li>
                  <li>สรุปยอดชำระสุทธิ</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-gray-400 italic">คุณกลับไปใช้ค่าที่คำนวณอัตโนมัติได้ทุกเมื่อ (ปิดสวิตช์ &quot;แก้ไขยอดเอง&quot;)</p>

            <label className="flex items-center gap-2 cursor-pointer select-none border-t border-gray-100 pt-3">
              <input type="checkbox" checked={warnAck} onChange={(e) => setWarnAck(e.target.checked)}
                className="w-4 h-4 accent-rose-500" />
              <span className="text-sm text-gray-600">เข้าใจแล้ว และไม่ต้องแสดงข้อความนี้อีก</span>
            </label>

            <div className="space-y-2 pt-1">
              <button onClick={confirmManualEdit}
                className="w-full py-3 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold transition-colors">
                ยืนยัน แก้ไขยอดเอง
              </button>
              <button onClick={() => setShowTaxWarn(false)}
                className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-colors">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </AppLayout>
  );
}
