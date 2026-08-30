"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { VendeeLogo } from "@/components/icons";

// Reviewer / demo access. Visiting this page signs into the seeded demo account
// automatically (no form) and lands on the dashboard. The account is public for
// reviewers; the password stays server-side and is never needed here.
export default function DemoLoginPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await signIn("demo", { auto: "1", redirect: false });
      if (cancelled) return;
      if (res?.ok) {
        // Skip the onboarding gate for the already-registered demo account.
        document.cookie = "vendee_onboarded=1; path=/; max-age=31536000";
        window.location.href = "/home";
      } else {
        setError("เข้าสู่ระบบเดโมไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-[#0A192F] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="flex flex-col items-center mb-6">
          <VendeeLogo className="w-12 h-12" />
          <h1 className="text-xl font-bold text-gray-900 mt-3">Vendee Finance</h1>
          <p className="text-sm text-gray-500 mt-1">Reviewer / Demo access</p>
        </div>

        {error ? (
          <>
            <p className="text-sm text-red-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 rounded-xl bg-[#0A192F] hover:bg-[#0d2242] text-white font-semibold text-sm transition-colors"
            >
              ลองใหม่อีกครั้ง
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-[#0A192F] rounded-full animate-spin" />
            <p className="text-sm text-gray-500">กำลังเข้าสู่ระบบเดโม...</p>
          </div>
        )}
      </div>
    </main>
  );
}
