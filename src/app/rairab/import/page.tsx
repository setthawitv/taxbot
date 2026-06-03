"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSession, signIn } from "next-auth/react";

type Platform = "tiktok" | "shopee" | "lazada";

type PreviewRow = {
  orderId:     string;
  date:        string;
  amount:      number;
  description: string;
};

type PreviewData = {
  count:          number;
  newCount:       number;
  newTotal:       number;
  existingCount:  number;
  cancelled:      number;
  returned:       number;
  skipped:        number;
  total:          number;
  rows:           PreviewRow[];
  platform:       Platform;
  overlapWarning?: boolean;
};

const PLATFORMS: { id: Platform; label: string; emoji: string; color: string; accept: string }[] = [
  { id: "tiktok",  label: "TikTok Shop", emoji: "🎵", color: "bg-gray-900",   accept: ".csv,.xlsx,.xls" },
  { id: "shopee",  label: "Shopee",      emoji: "🛒", color: "bg-orange-500", accept: ".csv,.xlsx,.xls" },
  { id: "lazada",  label: "Lazada",      emoji: "📦", color: "bg-blue-600",   accept: ".csv,.xlsx,.xls" },
];

export default function ImportPage() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady, setAuthReady]   = useState(false); // true once auth check done
  const [step, setStep]     = useState<"platform" | "upload" | "preview" | "done">("platform");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [preview, setPreview]   = useState<PreviewData | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: session, status: sessionStatus } = useSession();

  // ── Resolve LINE user ID (LIFF first, Google session fallback) ──────────────
  useEffect(() => {
    if (sessionStatus === "loading") return; // wait for next-auth

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    async function resolveUser() {
      // 1️⃣ Try LIFF (works when opened inside LINE app)
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
        } catch {
          // Not in LINE context — fall through to Google session
        }
      }

      // 2️⃣ Fall back to Google session (regular browser)
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const data = await res.json();
            if (data.lineUserId) {
              setLineUserId(data.lineUserId);
            }
          }
        } catch {
          // ignore — lineUserId stays empty
        }
      }

      setAuthReady(true);
    }

    resolveUser();
  }, [sessionStatus, session]);

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

  // ── Loading: waiting for auth ──────────────────────────────────────────────
  if (!authReady) {
    return (
      <main className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <p className="text-gray-400">กำลังโหลด...</p>
      </main>
    );
  }

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

          {/* Auth banner — shown when not logged in via LINE or Google */}
          {!lineUserId && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-amber-700 text-sm font-medium mb-3">
                ⚠️ ยังไม่ได้เข้าสู่ระบบ — ดูตัวอย่างได้ แต่บันทึกไม่ได้
              </p>
              <button
                onClick={() => signIn("google")}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl text-sm active:scale-95 transition-all shadow-sm"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </button>
            </div>
          )}

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
            {/* Total */}
            <p className="text-xs opacity-75 mb-0.5">ยอดรวมสำเร็จ</p>
            <p className="text-3xl font-bold mb-4">
              ฿{preview.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
            </p>
            {/* Order stats */}
            <div className="grid grid-cols-3 gap-2 text-center border-t border-white/20 pt-3 mb-3">
              <div>
                <p className="text-xl font-bold">{preview.count}</p>
                <p className="text-xs opacity-75">สั่งซื้อสำเร็จ</p>
              </div>
              <div>
                <p className="text-xl font-bold">{preview.returned}</p>
                <p className="text-xs opacity-75">คืนสินค้า</p>
              </div>
              <div>
                <p className="text-xl font-bold">{preview.cancelled}</p>
                <p className="text-xs opacity-75">ยกเลิก</p>
              </div>
            </div>
            {/* Import dedup status */}
            <div className="grid grid-cols-2 gap-2 text-center border-t border-white/20 pt-3">
              <div className="bg-white/15 rounded-xl py-2">
                <p className="text-lg font-bold">{preview.newCount}</p>
                <p className="text-xs opacity-80">✨ ใหม่</p>
              </div>
              <div className="bg-white/10 rounded-xl py-2">
                <p className="text-lg font-bold">{preview.existingCount}</p>
                <p className="text-xs opacity-70">มีในระบบแล้ว</p>
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

          {preview.overlapWarning && (
            <div className="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm">
              <p className="font-semibold text-amber-800 mb-1">⚠️ ช่วงวันที่คาบเกี่ยวกับไฟล์เก่า</p>
              <p className="text-amber-700 leading-relaxed">
                มีไฟล์รายงาน TikTok ที่นำเข้าไปแล้วซึ่งช่วงวันที่ทับซ้อนกัน
                ถ้าบันทึกไฟล์นี้เพิ่ม <strong>ยอดรายรับจะนับซ้ำ</strong> ทำให้ตัวเลขเพี้ยน
              </p>
              <p className="text-amber-600 text-xs mt-2">
                แนะนำ: ดาวน์โหลดไฟล์ใหม่ที่ครอบคลุมช่วงเวลาที่ไม่ทับกัน หรือลบรายการเก่าก่อนนำเข้าใหม่
              </p>
            </div>
          )}

          {error && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
              ⚠️ {error}
            </div>
          )}

          {!lineUserId ? (
            /* Not authenticated — offer Google sign-in */
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">กรุณาเข้าสู่ระบบเพื่อบันทึกข้อมูล</p>
              <button
                onClick={() => signIn("google")}
                className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 font-semibold py-3 rounded-2xl shadow-sm active:scale-95 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                เข้าสู่ระบบด้วย Google
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">หรือเปิดหน้านี้ผ่านแอป LINE</p>
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-emerald-200"
            >
              {loading
                ? "⏳ กำลังบันทึก..."
                : preview.newCount === 0
                  ? "✅ ข้อมูลทั้งหมดมีในระบบแล้ว"
                  : `✅ บันทึก ${preview.newCount} รายการใหม่ · ฿${(preview.newTotal ?? preview.total).toLocaleString("th-TH", { maximumFractionDigits: 0 })}`
              }
            </button>
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
