"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  amount: number;
  vendor: string;
  description: string;
  transaction_date: string;
};

export default function RaiRab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/transactions?type=income")
      .then((r) => r.json())
      .then((data) => {
        const txns = data.transactions ?? [];
        setTransactions(txns);
        setTotal(txns.reduce((s: number, t: Transaction) => s + Number(t.amount), 0));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-emerald-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-emerald-600 text-sm">← กลับ</Link>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">💰</div>
            <div>
              <h1 className="text-xl font-bold text-emerald-700">รายรับ</h1>
              <p className="text-emerald-500 text-sm">Income</p>
            </div>
          </div>
          <Link
            href="/rairab/import"
            className="flex items-center gap-1.5 bg-emerald-500 text-white text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
          >
            📤 นำเข้าไฟล์
          </Link>
        </div>

        {/* Total card */}
        <div className="bg-emerald-500 text-white rounded-2xl p-5 mb-5">
          <p className="text-sm opacity-80">รายรับทั้งหมด</p>
          <p className="text-3xl font-bold mt-1">
            ฿{total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-center text-gray-400 py-10">กำลังโหลด...</p>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-emerald-100">
            <p className="text-3xl mb-2">📭</p>
            <p>ยังไม่มีรายการรายรับ</p>
            <p className="text-sm mt-1">ส่งสลิปใน LINE เพื่อบันทึก</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {transactions.map((t) => (
              <li key={t.id} className="bg-white rounded-2xl p-4 border border-emerald-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
                  💰
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{t.vendor}</p>
                  <p className="text-xs text-gray-400 truncate">{t.description}</p>
                  <p className="text-xs text-gray-300">{t.transaction_date}</p>
                </div>
                <p className="text-emerald-600 font-semibold flex-shrink-0">
                  +฿{Number(t.amount).toLocaleString("th-TH")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
