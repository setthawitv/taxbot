"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import ThaiDateInput from "@/components/ThaiDateInput";
import CameraCapture from "@/components/CameraCapture";
import { useSession } from "next-auth/react";

type OcrReceipt = {
  type:            "income" | "expense";
  amount:          number;
  vendor:          string;
  date:            string;
  description:     string;
  docType:         string;
  expenseCategory: string;
  vatAmount:       number;
  withholdingTax:  number;
  invoiceNo:       string;
  taxId:           string;
};

type SavedResult = {
  id:          string;
  sheetSynced: boolean;
  driveSynced: boolean;
};

const fmt = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ScanPageInner() {
  const [userId, setUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const { data: session, status: sessionStatus } = useSession();

  // Step: "upload" | "preview" | "review" | "done"
  const [step,    setStep]    = useState<"upload" | "preview" | "review" | "done">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  // OCR result — editable
  const [ocr, setOcr] = useState<OcrReceipt | null>(null);

  // After save
  const [saved, setSaved] = useState<SavedResult | null>(null);

  const fileRef   = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  // ── Auth ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolve() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) { const d = await res.json(); if (d.userId) setUserId(d.userId); }
        } catch { /* ignore */ }
      }
      setAuthReady(true);
    }
    resolve();
  }, [sessionStatus, session]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function handleFile(file: File | null) {
    if (!file) return;
    setError("");
    setOcr(null);
    setSaved(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setStep("preview");
    };
    reader.readAsDataURL(file);
  }

  function reset() {
    setPreview(null);
    setOcr(null);
    setSaved(null);
    setError("");
    setStep("upload");
  }

  // ── Step 2: OCR ───────────────────────────────────────────────────────────────
  async function handleScan() {
    if (!preview || !userId) return;
    setScanning(true);
    setError("");
    try {
      const res  = await fetch("/api/scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, imageBase64: preview }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setOcr(data.receipt);
      setStep("review");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanning(false);
    }
  }

  // ── Step 3: Save ──────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!ocr || !userId) return;
    setSaving(true);
    setError("");
    try {
      const res  = await fetch("/api/transactions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          userId,
          type:            ocr.type,
          amount:          ocr.amount,
          vendor:          ocr.vendor,
          description:     ocr.description,
          date:            ocr.date,
          expenseCategory: ocr.expenseCategory,
          source:          "slip_photo",
          vatAmount:       ocr.vatAmount,
          withholdingTax:  ocr.withholdingTax,
          invoiceNo:       ocr.invoiceNo,
          taxId:           ocr.taxId,
          imageBase64:     preview,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setSaved({ id: data.id, sheetSynced: data.sheetSynced, driveSynced: data.driveSynced });
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  }

  if (!authReady) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-4xl animate-pulse">📸</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-6">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Link href="/home" className="text-gray-500 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">📸</div>
          <div>
            <h1 className="text-xl font-bold text-white">สแกนใบเสร็จ</h1>
            <p className="text-gray-400 text-sm">ถ่ายรูปหรืออัปโหลด → AI อ่านให้อัตโนมัติ</p>
          </div>
        </div>

        {/* ── Step 1: Upload ──────────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-3">
            <button onClick={() => setShowCamera(true)}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800 text-white hover:border-gray-400 hover:bg-gray-700 transition-colors">
              <span className="text-3xl">📷</span>
              <div className="text-left">
                <p className="font-semibold">ถ่ายรูป</p>
                <p className="text-xs text-gray-400">เปิดกล้องเพื่อถ่ายใบเสร็จ</p>
              </div>
            </button>

            <button onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800 text-white hover:border-gray-400 hover:bg-gray-700 transition-colors">
              <span className="text-3xl">🖼️</span>
              <div className="text-left">
                <p className="font-semibold">เลือกรูปจากคลัง</p>
                <p className="text-xs text-gray-400">รองรับ JPG, PNG, HEIC</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

            {showCamera && (
              <CameraCapture
                onCapture={(dataUrl) => { setPreview(dataUrl); setStep("preview"); setShowCamera(false); }}
                onClose={() => setShowCamera(false)}
              />
            )}
          </div>
        )}

        {/* ── Step 2: Preview → Scan ──────────────────────────────────────────── */}
        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="receipt" className="w-full max-h-80 object-contain" />
              <button onClick={reset}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-black/80">
                ×
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm">❌ {error}</p>
              </div>
            )}

            <button onClick={handleScan} disabled={scanning || !userId}
              className="w-full py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {scanning
                ? <><span className="animate-spin">⏳</span> AI กำลังอ่านใบเสร็จ...</>
                : <>🤖 สแกนด้วย AI</>}
            </button>
          </div>
        )}

        {/* ── Step 3: Review & Edit → Confirm ────────────────────────────────── */}
        {step === "review" && ocr && (
          <div className="space-y-4">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl px-4 py-3">
              <p className="text-blue-300 text-sm font-medium">✏️ ตรวจสอบและแก้ไขก่อนบันทึก</p>
            </div>

            <div className="bg-gray-800 rounded-2xl p-5 space-y-4">

              {/* Type toggle */}
              <div>
                <p className="text-gray-400 text-xs mb-2">ประเภท</p>
                <div className="flex gap-2">
                  {(["expense", "income"] as const).map((t) => (
                    <button key={t} onClick={() => setOcr({ ...ocr, type: t })}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        ocr.type === t
                          ? t === "income" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                          : "bg-gray-700 text-gray-400"
                      }`}>
                      {t === "income" ? "💰 รายรับ" : "🧾 รายจ่าย"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">จำนวนเงิน (บาท)</label>
                <input
                  type="number" inputMode="decimal"
                  value={ocr.amount}
                  onChange={(e) => setOcr({ ...ocr, amount: Number(e.target.value) })}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Vendor */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">ร้านค้า / ผู้รับเงิน</label>
                <input
                  type="text"
                  value={ocr.vendor}
                  onChange={(e) => setOcr({ ...ocr, vendor: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">วันที่</label>
                <ThaiDateInput
                  value={ocr.date}
                  onChange={(v) => setOcr({ ...ocr, date: v })}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-gray-400 text-xs mb-1 block">รายละเอียด</label>
                <input
                  type="text"
                  value={ocr.description}
                  onChange={(e) => setOcr({ ...ocr, description: e.target.value })}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* VAT + Withholding (collapsible — show only if non-zero) */}
              {(ocr.vatAmount > 0 || ocr.withholdingTax > 0 || ocr.taxId) && (
                <div className="border-t border-gray-700 pt-4 space-y-3">
                  {ocr.vatAmount > 0 && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">VAT (บาท)</label>
                      <input type="number" inputMode="decimal" value={ocr.vatAmount}
                        onChange={(e) => setOcr({ ...ocr, vatAmount: Number(e.target.value) })}
                        className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                  {ocr.withholdingTax > 0 && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">ภาษีหัก ณ ที่จ่าย (บาท)</label>
                      <input type="number" inputMode="decimal" value={ocr.withholdingTax}
                        onChange={(e) => setOcr({ ...ocr, withholdingTax: Number(e.target.value) })}
                        className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                  {ocr.taxId && (
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">เลขประจำตัวผู้เสียภาษี</label>
                      <input type="text" value={ocr.taxId}
                        onChange={(e) => setOcr({ ...ocr, taxId: e.target.value })}
                        className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-400 text-sm">❌ {error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep("preview")}
                className="px-5 py-3 rounded-2xl text-sm font-semibold bg-gray-700 text-white hover:bg-gray-600 transition-colors">
                ← ถ่ายใหม่
              </button>
              <button onClick={handleSave} disabled={saving || !ocr.amount || !ocr.vendor}
                className="flex-1 py-3 rounded-2xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {saving
                  ? <><span className="animate-spin text-base">⏳</span> กำลังบันทึก...</>
                  : <>✅ ยืนยันบันทึก</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ─────────────────────────────────────────────────────── */}
        {step === "done" && saved && ocr && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-emerald-400 font-bold text-lg">บันทึกสำเร็จ!</p>
              <p className="text-gray-400 text-xs mt-1">
                {saved.sheetSynced ? "ซิงค์ไป Google Sheets แล้ว ✓" : "บันทึกใน Database แล้ว"}
                {saved.driveSynced ? " · Drive ✓" : ""}
              </p>
            </div>

            {/* Summary */}
            <div className="bg-gray-800 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ประเภท</span>
                <span className={`font-semibold ${ocr.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {ocr.type === "income" ? "รายรับ" : "รายจ่าย"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">จำนวนเงิน</span>
                <span className="text-white font-bold">฿{fmt(ocr.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">ร้านค้า</span>
                <span className="text-white truncate max-w-[55%] text-right">{ocr.vendor}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">วันที่</span>
                <span className="text-white">{ocr.date}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={reset}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-gray-700 text-white hover:bg-gray-600 transition-colors">
                📸 สแกนใหม่
              </button>
              <Link href="/raijhai"
                className="flex-1 py-3 rounded-2xl text-sm font-semibold bg-gray-700 text-white hover:bg-gray-600 transition-colors text-center">
                📋 ดูรายจ่าย
              </Link>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-4xl animate-pulse">📸</div>
      </main>
    }>
      <ScanPageInner />
    </Suspense>
  );
}
