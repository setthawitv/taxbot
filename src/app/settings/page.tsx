"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";

type VendorRule = {
  id: string;
  vendor_name: string;
  type: "income" | "expense";
};

function SettingsPageInner() {
  const [vendors, setVendors] = useState<VendorRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [saving, setSaving] = useState(false);
  const [lineUserId, setLineUserId] = useState<string>("");
  const [googleEmail, setGoogleEmail] = useState<string>("");
  const [connecting, setConnecting] = useState(false);

  // Init LIFF to get LINE user ID + current Google status
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) return;
    import("@line/liff").then(({ default: liff }) => {
      liff.init({ liffId }).then(async () => {
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          const res = await fetch(`/api/user/status?lineUserId=${profile.userId}`);
          if (res.ok) {
            const data = await res.json();
            setGoogleEmail(data.email ?? "");
          }
        }
      }).catch(() => {});
    });
  }, []);

  // Open Google connect in external browser
  // Strategy: liff.openWindow({ external: true }) only works when the page was opened
  // via the LIFF URL (liff.line.me/...). Settings is opened via direct URL from the
  // Rich Menu, so it has no LIFF context. We store the user ID in localStorage and
  // redirect to the LIFF URL; the intro page detects the key and calls openWindow
  // from there (where it always has full LIFF context).
  async function handleGoogleConnect() {
    if (!lineUserId) return;
    setConnecting(true);

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    if (liffId && typeof window !== "undefined") {
      // Store the pending reconnect so intro page can pick it up
      localStorage.setItem("reconnect_google_lid", lineUserId);
      // Redirect to LIFF URL — intro will call liff.openWindow({ external: true })
      window.location.href = `https://liff.line.me/${liffId}`;
    } else {
      // Fallback for non-LINE / no LIFF ID
      window.location.href = `/connect-google?lid=${lineUserId}&ext=1`;
    }
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
    <main className="min-h-screen bg-gray-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-500 text-sm">← กลับ</Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">⚙️</div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">ตั้งค่าบัญชี</h1>
            <p className="text-gray-400 text-sm">Account Settings</p>
          </div>
        </div>

        {/* Google connection section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-1">เชื่อมต่อ Google</h2>
          <p className="text-xs text-gray-400 mb-4">
            เชื่อมต่อเพื่อบันทึกหลักฐานไปยัง Google Drive และ Google Sheet อัตโนมัติ
          </p>
          {googleEmail ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-4 py-3">
                <span className="text-emerald-500 text-lg">✅</span>
                <div>
                  <p className="text-xs text-gray-500">เชื่อมต่อแล้ว</p>
                  <p className="text-sm font-medium text-gray-700">{googleEmail}</p>
                </div>
              </div>
              <button
                onClick={handleGoogleConnect}
                disabled={!lineUserId || connecting}
                className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-40"
              >
                {connecting ? "⏳ รอการเชื่อมต่อ..." : "🔄 เชื่อมต่อใหม่อีกครั้ง"}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleConnect}
              disabled={!lineUserId || connecting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-40"
            >
              {connecting ? "⏳ รอการเชื่อมต่อ..." : "🔗 เชื่อมต่อ Google"}
            </button>
          )}
        </div>

        {/* Vendor rules section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="font-semibold text-gray-700 mb-1">รายชื่อผู้จ่าย/ผู้รับเงิน</h2>
          <p className="text-xs text-gray-400 mb-4">
            กำหนดว่าชื่อร้านค้าหรือบุคคลไหนเป็น รายรับ หรือ รายจ่าย
            AI จะใช้รายการนี้ในการแยกประเภทอัตโนมัติ
          </p>

          {/* Add form */}
          <form onSubmit={addVendor} className="flex flex-col gap-3 mb-5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชื่อร้านค้า / บุคคล เช่น Shopee, ลูกค้า A"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("income")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                  ${type === "income" ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"}`}
              >
                💰 รายรับ
              </button>
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors
                  ${type === "expense" ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500"}`}
              >
                🧾 รายจ่าย
              </button>
            </div>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-gray-800 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {saving ? "กำลังบันทึก..." : "+ เพิ่มรายการ"}
            </button>
          </form>

          {/* List */}
          {loading ? (
            <p className="text-center text-gray-400 text-sm py-4">กำลังโหลด...</p>
          ) : vendors.length === 0 ? (
            <p className="text-center text-gray-300 text-sm py-4">ยังไม่มีรายการ</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {vendors.map((v) => (
                <li key={v.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0
                    ${v.type === "income" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    {v.type === "income" ? "รายรับ" : "รายจ่าย"}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 truncate">{v.vendor_name}</span>
                  <button
                    onClick={() => deleteVendor(v.id)}
                    className="text-gray-300 hover:text-rose-400 text-lg leading-none flex-shrink-0"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
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
