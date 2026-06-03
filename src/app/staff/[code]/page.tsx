"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const EXPENSE_CATEGORIES = [
  "ค่าสินค้า", "ค่าขนส่ง", "ค่าแพ็คเกจ", "ค่าโฆษณา",
  "ค่าอุปกรณ์", "ค่าเช่า", "ค่าสาธารณูปโภค", "อื่นๆ",
];

const STAFF_NAME_KEY = "taxbot_staff_name";

export default function StaffExpensePage() {
  const { code } = useParams<{ code: string }>();

  const [status,    setStatus]    = useState<"loading" | "invalid" | "disabled" | "ok">("loading");
  const [ownerName, setOwnerName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [nameSet,   setNameSet]   = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Form
  const [vendor,   setVendor]   = useState("");
  const [amount,   setAmount]   = useState("");
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [desc,     setDesc]     = useState("");
  const [category, setCategory] = useState("อื่นๆ");
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  // Verify invite code
  useEffect(() => {
    if (!code) return;
    fetch(`/api/staff/verify?code=${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error === "Invalid code")   { setStatus("invalid");  return; }
        if (d.error === "Invite disabled"){ setStatus("disabled"); return; }
        setOwnerName(d.ownerName ?? "เจ้าของร้าน");
        setStatus("ok");
      })
      .catch(() => setStatus("invalid"));
  }, [code]);

  // Check for saved staff name in localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STAFF_NAME_KEY);
    if (saved) { setStaffName(saved); setNameSet(true); }
  }, []);

  function confirmName() {
    if (!nameInput.trim()) return;
    localStorage.setItem(STAFF_NAME_KEY, nameInput.trim());
    setStaffName(nameInput.trim());
    setNameSet(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendor.trim() || !amount) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffCode:       code,
          staffName:       staffName,
          type:            "expense",
          amount:          parseFloat(amount),
          vendor:          vendor.trim(),
          description:     desc.trim() || vendor.trim(),
          date,
          expenseCategory: category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");
      setSaveMsg({ ok: true, text: `✅ บันทึกรายจ่าย ฿${parseFloat(amount).toLocaleString("th-TH")} แล้ว` });
      setVendor(""); setAmount(""); setDesc(""); setCategory("อื่นๆ");
    } catch (err: unknown) {
      setSaveMsg({ ok: false, text: `❌ ${err instanceof Error ? err.message : "เกิดข้อผิดพลาด"}` });
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <main className="min-h-screen bg-rose-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🧾</div>
          <p className="text-gray-400 text-sm">กำลังตรวจสอบ...</p>
        </div>
      </main>
    );
  }

  // ── Invalid / Disabled ─────────────────────────────────────────────────────
  if (status === "invalid" || status === "disabled") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-sm w-full">
          <p className="text-4xl mb-4">{status === "disabled" ? "🔒" : "❌"}</p>
          <h1 className="text-lg font-bold text-gray-700 mb-2">
            {status === "disabled" ? "ลิงก์ถูกปิดแล้ว" : "ลิงก์ไม่ถูกต้อง"}
          </h1>
          <p className="text-gray-400 text-sm">
            {status === "disabled"
              ? "เจ้าของได้ปิดลิงก์นี้แล้ว กรุณาขอลิงก์ใหม่"
              : "ลิงก์นี้ไม่มีในระบบ กรุณาตรวจสอบ URL อีกครั้ง"}
          </p>
        </div>
      </main>
    );
  }

  // ── Enter name (first time) ────────────────────────────────────────────────
  if (!nameSet) {
    return (
      <main className="min-h-screen bg-rose-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-rose-100 p-8 max-w-sm w-full shadow-sm">
          <div className="text-center mb-6">
            <p className="text-4xl mb-2">🧾</p>
            <h1 className="text-lg font-bold text-gray-800">บันทึกรายจ่าย</h1>
            <p className="text-gray-400 text-sm mt-1">ให้กับ <span className="text-rose-600 font-semibold">{ownerName}</span></p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">ชื่อของคุณ *</label>
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmName()}
                placeholder="เช่น น้องปลา, แม่ค้าหน้าร้าน"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200"
                autoFocus
              />
            </div>
            <button
              onClick={confirmName}
              disabled={!nameInput.trim()}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
            >
              เริ่มบันทึกรายจ่าย →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Main expense form ──────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-rose-50 px-4 py-8">
      <div className="max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="text-3xl">🧾</div>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-rose-700">บันทึกรายจ่าย</h1>
            <p className="text-xs text-gray-400">
              ให้กับ <span className="text-rose-500 font-medium">{ownerName}</span>
              {" · "}สวัสดี <span className="text-gray-600 font-medium">{staffName}</span>
            </p>
          </div>
          <button
            onClick={() => { localStorage.removeItem(STAFF_NAME_KEY); setNameSet(false); setNameInput(""); }}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            เปลี่ยนชื่อ
          </button>
        </div>

        {/* Feedback */}
        {saveMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${saveMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-600"}`}>
            {saveMsg.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-rose-100 p-5 space-y-4 shadow-sm">

          <div>
            <label className="text-xs text-gray-500 mb-1 block">ร้านค้า / ผู้รับเงิน *</label>
            <input value={vendor} onChange={(e) => setVendor(e.target.value)}
              placeholder="เช่น Kerry, Lazada, ค่าไฟ"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">จำนวนเงิน (บาท) *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)}
                type="number" min="0.01" step="0.01" placeholder="0.00" required
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

          <div>
            <label className="text-xs text-gray-500 mb-2 block">หมวดหมู่</label>
            <div className="flex flex-wrap gap-1.5">
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

          <button type="submit" disabled={saving || !vendor.trim() || !amount}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl text-sm transition-colors">
            {saving ? "กำลังบันทึก..." : "💾 บันทึกรายจ่าย"}
          </button>
        </form>

        <p className="text-xs text-gray-300 text-center mt-6">
          Vendee Finance · ระบบบันทึกรายจ่าย
        </p>
      </div>
    </main>
  );
}
