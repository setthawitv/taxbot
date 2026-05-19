"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

const EXPENSE_CATEGORIES = [
  "ค่าสินค้า", "ค่าขนส่ง", "ค่าแพ็คเกจ", "ค่าโฆษณา",
  "ค่าอุปกรณ์", "ค่าเช่า", "ค่าสาธารณูปโภค", "อื่นๆ",
];

type Transaction = {
  id: string;
  amount: number;
  vendor: string;
  description: string;
  transaction_date: string;
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RaiJhai() {
  const [lineUserId, setLineUserId] = useState("");
  const [authReady,  setAuthReady]  = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [total,        setTotal]        = useState(0);

  // Form state
  const [showForm,   setShowForm]   = useState(false);
  const [vendor,     setVendor]     = useState("");
  const [amount,     setAmount]     = useState("");
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [desc,       setDesc]       = useState("");
  const [category,   setCategory]   = useState("อื่นๆ");
  const [saving,     setSaving]     = useState(false);
  const [saveMsg,    setSaveMsg]    = useState<{ ok: boolean; text: string } | null>(null);

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
          // Inside LINE app but not logged in → force LIFF login
          if (liff.isInClient()) {
            liff.login();
            return;
          }
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
    fetch(`/api/transactions?type=expense&lineUserId=${uid}`)
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
  }, [authReady, lineUserId]);

  // ── Save new expense ──────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lineUserId || !vendor.trim() || !amount) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          amount:          parseFloat(amount),
          vendor:          vendor.trim(),
          description:     desc.trim(),
          date,
          expenseCategory: category,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด");

      setSaveMsg({
        ok:   true,
        text: data.sheetSynced ? "✅ บันทึกแล้ว · ซิงค์ Sheets แล้ว" : "✅ บันทึกแล้ว",
      });

      // Reset form & reload
      setVendor(""); setAmount(""); setDesc(""); setCategory("อื่นๆ");
      setDate(new Date().toISOString().slice(0, 10));
      setShowForm(false);
      loadTxns(lineUserId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setSaveMsg({ ok: false, text: `❌ ${msg}` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-rose-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-rose-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">🧾</div>
            <div>
              <h1 className="text-xl font-bold text-rose-700">รายจ่าย</h1>
              <p className="text-rose-500 text-sm">Expense</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setSaveMsg(null); }}
            className="bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            {showForm ? "ยกเลิก" : "+ เพิ่มรายจ่าย"}
          </button>
        </div>

        {/* Total card */}
        <div className="bg-rose-500 text-white rounded-2xl p-5 mb-4">
          <p className="text-sm opacity-80">รายจ่ายทั้งหมด</p>
          <p className="text-3xl font-bold mt-1">฿{fmt(total)}</p>
        </div>

        {/* Save feedback */}
        {saveMsg && (
          <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${saveMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
            {saveMsg.text}
          </div>
        )}

        {/* ── Add expense form ────────────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl border border-rose-100 p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700 mb-1">บันทึกรายจ่ายใหม่</p>

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

            <div>
              <label className="text-xs text-gray-500 mb-1 block">หมวดหมู่</label>
              <div className="flex flex-wrap gap-2">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      category === c
                        ? "bg-rose-500 text-white"
                        : "bg-rose-50 text-rose-600 border border-rose-200"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={saving || !vendor.trim() || !amount}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
              {saving ? "กำลังบันทึก..." : "💾 บันทึกรายจ่าย"}
            </button>
          </form>
        )}

        {/* ── Transaction list ────────────────────────────────────────────────── */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">กำลังโหลด...</p>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-rose-100">
            <p className="text-3xl mb-2">📭</p>
            <p>ยังไม่มีรายการรายจ่าย</p>
            <p className="text-sm mt-1">กด + เพิ่มรายจ่าย หรือส่งสลิปใน LINE</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {transactions.map((t) => (
              <li key={t.id} className="bg-white rounded-2xl p-4 border border-rose-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-lg flex-shrink-0">
                  🧾
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{t.vendor}</p>
                  <p className="text-xs text-gray-400 truncate">{t.description}</p>
                  <p className="text-xs text-gray-300">{t.transaction_date}</p>
                </div>
                <p className="text-rose-600 font-semibold flex-shrink-0">
                  -฿{Number(t.amount).toLocaleString("th-TH")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
