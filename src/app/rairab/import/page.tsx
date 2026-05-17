"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Platform = "tiktok" | "shopee" | "lazada";

type PreviewRow = {
  orderId:     string;
  date:        string;
  amount:      number;
  description: string;
};

type PreviewData = {
  count:    number;
  skipped:  number;
  total:    number;
  rows:     PreviewRow[];
  platform: Platform;
};

const PLATFORMS: { id: Platform; label: string; emoji: string; color: string; accept: string }[] = [
  { id: "tiktok",  label: "TikTok Shop", emoji: "🎵", color: "bg-gray-900",   accept: ".csv,.xlsx,.xls" },
  { id: "shopee",  label: "Shopee",      emoji: "🛒", color: "bg-orange-500", accept: ".csv,.xlsx,.xls" },
  { id: "lazada",  label: "Lazada",      emoji: "📦", color: "bg-blue-600",   accept: ".csv,.xlsx,.xls" },
];

export default function ImportPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [step, setStep]     = useState<"platform" | "upload" | "preview" | "done">("platform");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [preview, setPreview]   = useState<PreviewData | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Init LIFF to get LINE user ID
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;
    import("@line/liff").then(({ default: liff }) => {
      liff.init({ liffId }).then(async () => {
        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          setLineUserId(p.userId);
        }
      }).catch(() => {});
    });
  }, []);

  function selectPlatform(p: Platform) {
    setPlatform(p);
    setStep("upload");
    setFile(null);
    setPreview(null);
    setError("");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !platform) return;
    setFile(f);
    setError("");
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file",        f);
      fd.append("platform",    platform);
      fd.append("lineUserId",  lineUserId || "preview");
      fd.append("preview",     "true");

      const res  = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      if (data.count === 0) throw new Error("ไม่พบคำสั่งซื้อที่สำเร็จในไฟล์นี้");

      setPreview(data);
      setStep("preview");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!file || !platform || !lineUserId) return;
    setLoading(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("file",        file);
      fd.append("platform",    platform);
      fd.append("lineUserId",  lineUserId);
      fd.append("preview",     "false");

      const res  = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      setStep("done");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setLoading(false);
    }
  }

  const pl = PLATFORMS.find((p) => p.id === platform);

  // ── Step: select platform ──────────────────────────────────────────────────
  if (step === "platform") {
    return (
      <main className="min-h-screen bg-emerald-50 flex flex-col px-4 py-8">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-6">
            <Link href="/rairab" className="text-emerald-600 text-sm">← กลับ</Link>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <div className="text-4xl">📤</div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">นำเข้าข้อมูลรายรับ</h1>
              <p className="text-gray-400 text-sm">เลือกแพลตฟอร์มของคุณ</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPlatform(p.id)}
                className={`w-full flex items-center gap-4 ${p.color} text-white rounded-2xl px-5 py-4 active:scale-95 transition-all shadow-sm`}
              >
                <span className="text-3xl">{p.emoji}</span>
                <div className="text-left">
                  <p className="font-bold text-base">{p.label}</p>
                  <p className="text-xs opacity-75">อัปโหลดไฟล์ Excel / CSV</p>
                </div>
                <span className="ml-auto text-xl opacity-60">›</span>
              </button>
            ))}
          </div>

          <div className="mt-6 bg-white rounded-2xl p-4 border border-emerald-100 text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-600 mb-2">📋 วิธีดาวน์โหลดไฟล์</p>
            <p>🎵 <strong>TikTok</strong> → Seller Center → Orders → Export</p>
            <p>🛒 <strong>Shopee</strong> → Seller Centre → Orders → Export</p>
            <p>📦 <strong>Lazada</strong> → Seller Center → Orders → Export</p>
          </div>
        </div>
      </main>
    );
  }

  // ── Step: upload file ──────────────────────────────────────────────────────
  if (step === "upload") {
    return (
      <main className="min-h-screen bg-emerald-50 flex flex-col px-4 py-8">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-6">
            <button onClick={() => setStep("platform")} className="text-emerald-600 text-sm">← กลับ</button>
          </div>
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{pl?.emoji}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{pl?.label}</h1>
              <p className="text-gray-400 text-sm">อัปโหลดไฟล์คำสั่งซื้อ</p>
            </div>
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="w-full border-2 border-dashed border-emerald-300 rounded-2xl py-12 flex flex-col items-center gap-3 bg-white active:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="text-4xl animate-spin">⏳</div>
                <p className="text-gray-500 font-medium">กำลังอ่านไฟล์...</p>
              </>
            ) : (
              <>
                <div className="text-4xl">📂</div>
                <p className="text-gray-700 font-semibold">กดเพื่อเลือกไฟล์</p>
                <p className="text-gray-400 text-xs">.csv, .xlsx, .xls</p>
              </>
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept={pl?.accept}
            className="hidden"
            onChange={handleFile}
          />

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              ⚠️ {error}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ── Step: preview & confirm ────────────────────────────────────────────────
  if (step === "preview" && preview) {
    return (
      <main className="min-h-screen bg-emerald-50 flex flex-col px-4 py-8">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-6">
            <button onClick={() => setStep("upload")} className="text-emerald-600 text-sm">← เลือกไฟล์ใหม่</button>
          </div>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl">{pl?.emoji}</span>
            <div>
              <h1 className="text-xl font-bold text-gray-800">ตรวจสอบข้อมูล</h1>
              <p className="text-gray-400 text-sm">{file?.name}</p>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-emerald-500 text-white rounded-2xl p-5 mb-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold">{preview.count}</p>
                <p className="text-xs opacity-80">คำสั่งซื้อ</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{preview.skipped}</p>
                <p className="text-xs opacity-80">ข้ามแล้ว</p>
              </div>
              <div>
                <p className="text-xl font-bold">฿{preview.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}</p>
                <p className="text-xs opacity-80">รวม</p>
              </div>
            </div>
          </div>

          {/* Preview rows */}
          <div className="bg-white rounded-2xl border border-emerald-100 mb-4 overflow-hidden">
            <p className="text-xs text-gray-500 px-4 pt-3 pb-2 border-b border-gray-100">
              ตัวอย่าง 5 รายการแรก
            </p>
            {preview.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{r.description}</p>
                  <p className="text-xs text-gray-400">{r.date} · #{r.orderId.slice(-8)}</p>
                </div>
                <p className="text-emerald-600 font-semibold text-sm flex-shrink-0">
                  +฿{Number(r.amount).toLocaleString("th-TH")}
                </p>
              </div>
            ))}
            {preview.count > 5 && (
              <p className="text-xs text-gray-400 text-center py-2">
                + อีก {preview.count - 5} รายการ
              </p>
            )}
          </div>

          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || !lineUserId}
            className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-emerald-200"
          >
            {loading ? "⏳ กำลังบันทึก..." : `✅ บันทึก ${preview.count} รายการ`}
          </button>
          {!lineUserId && (
            <p className="text-xs text-gray-400 text-center mt-2">กรุณาเปิดผ่านแอป LINE เพื่อบันทึก</p>
          )}
        </div>
      </main>
    );
  }

  // ── Step: done ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-800 mb-2">บันทึกสำเร็จ!</h1>
        <p className="text-gray-500 text-sm mb-1">
          นำเข้าข้อมูลจาก {pl?.label} เรียบร้อยแล้ว
        </p>
        <p className="text-emerald-500 font-semibold text-lg mb-6">
          ฿{preview?.total.toLocaleString("th-TH", { maximumFractionDigits: 0 })}
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/rairab"
            className="w-full bg-emerald-500 text-white font-bold py-3 rounded-2xl text-center block"
          >
            ดูรายรับทั้งหมด
          </Link>
          <button
            onClick={() => { setStep("platform"); setFile(null); setPreview(null); }}
            className="w-full bg-white border border-emerald-200 text-emerald-600 font-semibold py-3 rounded-2xl"
          >
            นำเข้าไฟล์เพิ่มเติม
          </button>
        </div>
      </div>
    </main>
  );
}
