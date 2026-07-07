"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { VendeeLogo } from "@/components/icons";

// Reviewer login (username + password) for platform approvers such as Shopee.
// Normal users sign in with Google; this page authenticates the seeded demo
// account via NextAuth's "demo" credentials provider.
export default function DemoLoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await signIn("demo", { email, password, redirect: false });
    if (res?.ok) {
      // Skip the onboarding gate for the already-registered demo account.
      document.cookie = "vendee_onboarded=1; path=/; max-age=31536000";
      window.location.href = "/home";
    } else {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <VendeeLogo className="w-12 h-12" />
          <h1 className="text-xl font-bold text-gray-900 mt-3">Vendee Finance</h1>
          <p className="text-sm text-gray-500 mt-1">Reviewer / Demo access</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="username" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F]/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password" required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F]/30"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit" disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl bg-[#0A192F] hover:bg-[#0d2242] text-white font-semibold text-sm transition-colors disabled:opacity-40"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center mt-5 leading-relaxed">
          หน้านี้สำหรับผู้ตรวจสอบระบบเท่านั้น · ผู้ใช้ทั่วไปเข้าสู่ระบบด้วย Google
        </p>
      </div>
    </main>
  );
}
