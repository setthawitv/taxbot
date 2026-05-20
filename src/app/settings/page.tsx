"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";

type VendorRule = {
  id: string;
  vendor_name: string;
  type: "income" | "expense";
};

type SyncResult = { synced: number; failed: number; skipped: number; message: string; lastError?: string } | null;
type AdminRow = { id: string; admin_email: string; admin_name: string | null; invite_code: string; status: string; created_at: string };

function SettingsPageInner() {
  const [vendors, setVendors] = useState<VendorRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [saving, setSaving] = useState(false);
  const [lineUserId, setLineUserId] = useState<string>("");
  const [googleEmail, setGoogleEmail] = useState<string>("");
  const [showLiffLink, setShowLiffLink] = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState<SyncResult>(null);

  // Business name
  const [businessName,        setBusinessName]        = useState("");
  const [businessNameDraft,   setBusinessNameDraft]   = useState("");
  const [savingBusinessName,  setSavingBusinessName]  = useState(false);
  const [businessNameSaved,   setBusinessNameSaved]   = useState(false);

  // Admin management
  const [admins,        setAdmins]        = useState<AdminRow[]>([]);
  const [adminLoading,  setAdminLoading]  = useState(false);
  const [adminEmail,    setAdminEmail]    = useState("");
  const [adminAdding,   setAdminAdding]   = useState(false);
  const [adminCopied,   setAdminCopied]   = useState<string>("");   // invite_code that was copied

  const { data: session, status: sessionStatus } = useSession();

  // Init LIFF → fallback to Google session for browser users
  useEffect(() => {
    if (sessionStatus === "loading") return;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    async function resolve() {
      if (liffId) {
        try {
          const { default: liff } = await import("@line/liff");
          await liff.init({ liffId });
          if (!liff.isLoggedIn() && !liff.isInClient() && /Line\//i.test(navigator.userAgent)) {
            window.location.replace(`https://liff.line.me/${liffId}`);
            return;
          }
          if (liff.isLoggedIn()) {
            const profile = await liff.getProfile();
            setLineUserId(profile.userId);
            const res = await fetch(`/api/user/status?lineUserId=${profile.userId}`);
            if (res.ok) {
              const data = await res.json();
              setGoogleEmail(data.email ?? "");
              const biz = data.profile?.businessName ?? "";
              setBusinessName(biz);
              setBusinessNameDraft(biz);
            }
            return;
          }
          if (liff.isInClient()) { liff.login(); return; }
        } catch { /* not in LINE */ }
      }

      // Fallback: Google session (browser)
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.lineUserId) {
              setLineUserId(d.lineUserId);
              setGoogleEmail(session.user.email ?? "");
              // Load business name
              const statusRes = await fetch(`/api/user/status?lineUserId=${d.lineUserId}`);
              if (statusRes.ok) {
                const statusData = await statusRes.json();
                const biz = statusData.profile?.businessName ?? "";
                setBusinessName(biz);
                setBusinessNameDraft(biz);
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    resolve();
  }, [sessionStatus, session]);

  async function saveBusinessName(e: React.FormEvent) {
    e.preventDefault();
    if (!lineUserId || !businessNameDraft.trim()) return;
    setSavingBusinessName(true);
    try {
      await fetch("/api/user/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lineUserId, businessName: businessNameDraft.trim() }),
      });
      setBusinessName(businessNameDraft.trim());
      setBusinessNameSaved(true);
      setTimeout(() => setBusinessNameSaved(false), 2000);
    } finally {
      setSavingBusinessName(false);
    }
  }

  // Open Google connect in external browser.
  // liff.openWindow({ external: true }) requires a user gesture AND proper LIFF context
  // (page opened via liff.line.me). Settings opens via direct Rich Menu URL, so we:
  // 1. Save lineUserId to localStorage
  // 2. Show a real <a> link to the LIFF URL — tapping it = user gesture + LIFF context
  // 3. Intro page detects the key and shows a "tap to open Safari" button
  function handleGoogleConnect() {
    if (!lineUserId) return;
    setShowLiffLink(true);
  }

  async function handleSyncSheets() {
    if (!lineUserId) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setSyncResult(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setSyncResult({ synced: 0, failed: 0, skipped: 0, message: `❌ ${msg}` });
    } finally {
      setSyncing(false);
    }
  }

  // Load admin list when lineUserId is available
  useEffect(() => {
    if (!lineUserId) return;
    setAdminLoading(true);
    fetch(`/api/admin/invite?lineUserId=${lineUserId}`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.admins)) setAdmins(d.admins); })
      .finally(() => setAdminLoading(false));
  }, [lineUserId]);

  function adminJoinLink(code: string) {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/admin/join?code=${code}`;
  }

  async function copyAdminLink(code: string) {
    await navigator.clipboard.writeText(adminJoinLink(code));
    setAdminCopied(code);
    setTimeout(() => setAdminCopied(""), 2000);
  }

  function sendAdminEmail(adminEmailAddr: string, code: string) {
    const link = adminJoinLink(code);
    const subject = encodeURIComponent("เชิญเป็น Admin TaxBot");
    const body = encodeURIComponent(
      `สวัสดี!\n\nคุณได้รับเชิญให้เป็น Admin บัญชี TaxBot\nกรุณาคลิกลิงก์ด้านล่างเพื่อยืนยันการเข้าร่วม:\n\n${link}\n\nหมายเหตุ: กรุณาลงชื่อด้วยบัญชี Google ของอีเมลนี้`
    );
    window.location.href = `mailto:${adminEmailAddr}?subject=${subject}&body=${body}`;
  }

  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    const email = adminEmail.trim().toLowerCase();
    if (!email || !lineUserId) return;
    setAdminAdding(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lineUserId, adminEmail: email }),
      });
      const d = await res.json();
      if (d.error) { alert(d.error); return; }
      // Reload list
      const list = await fetch(`/api/admin/invite?lineUserId=${lineUserId}`).then((r) => r.json());
      if (Array.isArray(list.admins)) setAdmins(list.admins);
      setAdminEmail("");
    } finally {
      setAdminAdding(false);
    }
  }

  async function removeAdmin(adminId: string) {
    if (!lineUserId) return;
    await fetch("/api/admin/invite", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lineUserId, adminId }),
    });
    setAdmins((prev) => prev.filter((a) => a.id !== adminId));
  }

  async function load() {
    const res = await fetch("/api/vendors");
    const data = await res.json();
    setVendors(data.vendors ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addVendor(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_name: name.trim(), type }),
    });
    setName("");
    await load();
    setSaving(false);
  }

  async function deleteVendor(id: string) {
    await fetch("/api/vendors", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setVendors((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/" className="text-gray-500 text-sm">← กลับ</Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">⚙️</div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">ตั้งค่าบัญชี</h1>
            <p className="text-gray-400 text-sm">Account Settings</p>
          </div>
        </div>

        {/* ── Desktop 2-column grid ────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start">

          {/* LEFT — Google + Sync */}
          <div className="space-y-4 mb-4 lg:mb-0">

            {/* Business name */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-1">ชื่อธุรกิจ</h2>
              <p className="text-xs text-gray-400 mb-4">
                ชื่อที่แสดงในหน้าหลักแทนชื่อ LINE
              </p>
              <form onSubmit={saveBusinessName} className="flex gap-2">
                <input
                  value={businessNameDraft}
                  onChange={(e) => setBusinessNameDraft(e.target.value)}
                  placeholder="เช่น ร้านดอกไม้มีนา, บริษัท ABC"
                  disabled={!lineUserId}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={savingBusinessName || !businessNameDraft.trim() || !lineUserId || businessNameDraft.trim() === businessName}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  {businessNameSaved ? "✅" : savingBusinessName ? "..." : "บันทึก"}
                </button>
              </form>
            </div>

            {/* Google connection */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-1">เชื่อมต่อ Google</h2>
              <p className="text-xs text-gray-400 mb-4">
                เชื่อมต่อเพื่อบันทึกหลักฐานไปยัง Google Drive และ Google Sheet อัตโนมัติ
              </p>
              {showLiffLink ? (
                <a
                  href={`${typeof window !== "undefined" ? window.location.origin : ""}/connect-google?lid=${lineUserId}&ext=1&openExternalBrowser=1`}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-blue-500 active:bg-blue-600 transition-colors text-center"
                >
                  🌐 กดที่นี่เพื่อเปิด Safari / Chrome
                </a>
              ) : googleEmail ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-3">
                    <span className="text-emerald-500 text-lg">✅</span>
                    <div>
                      <p className="text-xs text-gray-500">เชื่อมต่อแล้ว</p>
                      <p className="text-sm font-medium text-gray-700">{googleEmail}</p>
                    </div>
                  </div>
                  <button onClick={handleGoogleConnect} disabled={!lineUserId}
                    className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40">
                    🔄 เชื่อมต่อใหม่อีกครั้ง
                  </button>
                </div>
              ) : (
                <button onClick={handleGoogleConnect} disabled={!lineUserId}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-40">
                  🔗 เชื่อมต่อ Google
                </button>
              )}
            </div>

            {/* Sync to Sheets */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-1">ซิงค์รายจ่ายไป Google Sheets</h2>
              <p className="text-xs text-gray-400 mb-4">
                นำรายจ่ายทั้งหมดใน database ที่ยังไม่มีใน Sheets ไปเพิ่มอัตโนมัติ
                (ตรวจสอบ ID ซ้ำให้อัตโนมัติ)
              </p>
              {syncResult && (
                <div className={`mb-3 p-3 rounded-xl text-sm ${
                  syncResult.failed > 0 && syncResult.synced === 0
                    ? "bg-red-50 text-red-700"
                    : syncResult.failed > 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}>
                  <p className="font-medium">{syncResult.message}</p>
                  {syncResult.skipped > 0 && (
                    <p className="text-xs mt-1 opacity-70">มีอยู่ใน Sheets แล้ว {syncResult.skipped} รายการ</p>
                  )}
                  {syncResult.lastError && (
                    <p className="text-xs mt-1 opacity-70 break-all">Error: {syncResult.lastError}</p>
                  )}
                </div>
              )}
              <button onClick={handleSyncSheets} disabled={syncing || !lineUserId || !googleEmail}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-600 text-white disabled:opacity-40 transition-colors">
                {syncing ? <>⏳ กำลังซิงค์...</> : <>📋 Sync รายจ่ายทั้งหมดไป Sheets</>}
              </button>
              {!googleEmail && (
                <p className="text-xs text-gray-400 text-center mt-2">เชื่อมต่อ Google ก่อนจึงจะซิงค์ได้</p>
              )}
            </div>

            {/* Admin management */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-1">🛡️ Admin — แชร์การเข้าถึง</h2>
              <p className="text-xs text-gray-400 mb-4">
                เพิ่มอีเมล Google ของบุคคลอื่น เพื่อให้เข้าถึง Dashboard และจัดการรายการได้ทั้งหมด
              </p>

              {/* Add admin form */}
              <form onSubmit={addAdmin} className="flex gap-2 mb-4">
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="อีเมล Google เช่น admin@gmail.com"
                  disabled={!lineUserId}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={adminAdding || !adminEmail.trim() || !lineUserId}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors flex-shrink-0"
                >
                  {adminAdding ? "..." : "+ เพิ่ม"}
                </button>
              </form>

              {/* Admin list */}
              {adminLoading ? (
                <p className="text-sm text-gray-400 text-center py-2">กำลังโหลด...</p>
              ) : admins.length === 0 ? (
                <p className="text-xs text-gray-300 text-center py-3">ยังไม่มี Admin</p>
              ) : (
                <ul className="space-y-2">
                  {admins.map((a) => (
                    <li key={a.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 font-medium truncate">{a.admin_email}</p>
                          {a.admin_name && (
                            <p className="text-xs text-gray-400">{a.admin_name}</p>
                          )}
                          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${
                            a.status === "accepted"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {a.status === "accepted" ? "✅ ยืนยันแล้ว" : "⏳ รอยืนยัน"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {a.status !== "accepted" && (
                            <button
                              onClick={() => copyAdminLink(a.invite_code)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                                adminCopied === a.invite_code
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                              }`}
                            >
                              {adminCopied === a.invite_code ? "✅ คัดลอก" : "🔗 คัดลอก"}
                            </button>
                          )}
                          <button
                            onClick={() => removeAdmin(a.id)}
                            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT — Vendor rules */}
          <div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-1">รายชื่อผู้จ่าย/ผู้รับเงิน</h2>
              <p className="text-xs text-gray-400 mb-4">
                กำหนดว่าชื่อร้านค้าหรือบุคคลไหนเป็น รายรับ หรือ รายจ่าย
                AI จะใช้รายการนี้ในการแยกประเภทอัตโนมัติ
              </p>

              <form onSubmit={addVendor} className="flex flex-col gap-3 mb-5">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="ชื่อร้านค้า / บุคคล เช่น Shopee, ลูกค้า A"
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setType("income")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      type === "income" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                    💰 รายรับ
                  </button>
                  <button type="button" onClick={() => setType("expense")}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      type === "expense" ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                    🧾 รายจ่าย
                  </button>
                </div>
                <button type="submit" disabled={saving || !name.trim()}
                  className="bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors">
                  {saving ? "กำลังบันทึก..." : "+ เพิ่มรายการ"}
                </button>
              </form>

              {loading ? (
                <p className="text-center text-gray-400 text-sm py-4">กำลังโหลด...</p>
              ) : vendors.length === 0 ? (
                <p className="text-center text-gray-300 text-sm py-4">ยังไม่มีรายการ</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {vendors.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        v.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {v.type === "income" ? "รายรับ" : "รายจ่าย"}
                      </span>
                      <span className="flex-1 text-sm text-gray-700 truncate">{v.vendor_name}</span>
                      <button onClick={() => deleteVendor(v.id)}
                        className="text-gray-300 hover:text-rose-400 text-lg leading-none flex-shrink-0">
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⚙️</div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    }>
      <SettingsPageInner />
    </Suspense>
  );
}
