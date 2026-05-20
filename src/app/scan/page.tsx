"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSession } from "next-auth/react";

type ReceiptResult = {
  id: string;
  sheetSynced: boolean;
  receipt: {
    type: "income" | "expense";
    amount: number;
    vendor: string;
    date: string;
    description: string;
    docType: string;
    expenseCategory: string;
    vatAmount: number;
    withholdingTax: number;
    invoiceNo: string;
    taxId: string;
  };
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ScanPageInner() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);
  const { data: session, status: sessionStatus } = useSession();

  const [preview,   setPreview]   = useState<string | null>(null);
  const [scanning,  setScanning]  = useState(false);
  const [result,    setResult]    = useState<ReceiptResult | null>(null);
  const [error,     setError]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Auth
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolve() {
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
          if (liff.isInClient()) { liff.login(); return; }
        } catch { /* not in LINE */ }
      }
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.lineUserId) { setLineUserId(d.lineUserId); }
          }
        } catch { /* ignore */ }
      }
      setAuthReady(true);
    }
    resolve();
  }, [sessionStatus, session]);

  function handleFile(file: File | null) {
    if (!file) return;
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!preview || !lineUserId) return;
    setScanning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lineUserId, imageBase64: preview }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setPreview(null);
    setResult(null);
    setError("");
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
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-500 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">📸</div>
          <div>
            <h1 className="text-xl font-bold text-white">สแกนใบเสร็จ</h1>
            <p className="text-gray-400 text-sm">ถ่ายรูปหรืออัปโหลด → AI อ่านให้อัตโนมัติ</p>
          </div>
        </div>

        {/* Upload area */}
        {!preview && (
          <div className="space-y-3">
            {/* Camera button (mobile) */}
            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800 text-white hover:border-gray-400 hover:bg-gray-700 transition-colors"
            >
              <span className="text-3xl">📷</span>
              <div className="text-left">
                <p className="font-semibold">ถ่ายรูป</p>
                <p className="text-xs text-gray-400">เปิดกล้องเพื่อถ่ายใบเสร็จ</p>
              </div>
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />

            {/* Upload from gallery */}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl border-2 border-dashed border-gray-600 bg-gray-800 text-white hover:border-gray-400 hover:bg-gray-700 transition-colors"
            >
              <span className="text-3xl">🖼️</span>
              <div className="text-left">
                <p className="font-semibold">เลือกรูปจากคลัง</p>
                <p className="text-xs text-gray-400">รองรับ JPG, PNG, HEIC</p>
              </div>
            </button>
            <input ref={fileRef} type="file" accept="image/*"
              className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
          </div>
        )}

        {/* Preview + scan button */}
        {preview && !result && (
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

            <button
              onClick={handleScan}
              disabled={scanning || !lineUserId}
              className="w-full py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <span className="animate-spin">⏳</span> AI กำลังอ่านใบเสร็จ...
                </>
              ) : (
                <>🤖 สแกนด้วย AI</>
              )}
            </button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            {/* Success banner */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-emerald-400 font-semibold">บันทึกสำเร็จแล้ว!</p>
                <p className="text-gray-400 text-xs">
                  {result.sheetSynced ? "ซิงค์ไป Google Sheets แล้ว ✓" : "บันทึกใน Database แล้ว"}
                </p>
              </div>
            </div>

            {/* Extracted data */}
            <div className="bg-gray-800 rounded-2xl p-5 space-y-3">
              <h2 className="text-white font-semibold text-sm mb-3">ข้อมูลที่ AI อ่านได้</h2>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">ประเภท</span>
                <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${
                  result.receipt.type === "income"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/20 text-rose-400"
                }`}>
                  {result.receipt.type === "income" ? "💰 รายรับ" : "🧾 รายจ่าย"}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">จำนวนเงิน</span>
                <span className="text-white font-bold text-lg">฿{fmt(result.receipt.amount)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">ร้านค้า / ผู้รับเงิน</span>
                <span className="text-white text-sm font-medium text-right max-w-[55%] truncate">{result.receipt.vendor}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">วันที่</span>
                <span className="text-white text-sm">{result.receipt.date}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">รายละเอียด</span>
                <span className="text-gray-300 text-sm text-right max-w-[55%]">{result.receipt.description}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">ประเภทเอกสาร</span>
                <span className="text-gray-300 text-sm">{result.receipt.docType}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">หมวดหมู่</span>
                <span className="text-gray-300 text-sm">{result.receipt.expenseCategory}</span>
              </div>

              {result.receipt.vatAmount > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">ภาษีมูลค่าเพิ่ม (VAT)</span>
                  <span className="text-gray-300 text-sm">฿{fmt(result.receipt.vatAmount)}</span>
                </div>
              )}

              {result.receipt.withholdingTax > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-gray-700">
                  <span className="text-gray-400 text-sm">ภาษีหัก ณ ที่จ่าย</span>
                  <span className="text-gray-300 text-sm">฿{fmt(result.receipt.withholdingTax)}</span>
                </div>
              )}

              {result.receipt.taxId && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-400 text-sm">เลขประจำตัวผู้เสียภาษี</span>
                  <span className="text-gray-300 text-sm font-mono">{result.receipt.taxId}</span>
                </div>
              )}
            </div>

            {/* Actions */}
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
