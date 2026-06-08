"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function SheetsRedirectPage() {
  const [status, setStatus] = useState<"loading" | "redirecting" | "no_sheet" | "no_google" | "error">("loading");
  const { data: session, status: sessionStatus } = useSession();

  useEffect(() => {
    if (sessionStatus === "loading") return;

    async function resolve() {
      if (!session?.user?.email) { setStatus("error"); return; }
      try {
        const byEmail = await fetch("/api/user/by-email");
        if (!byEmail.ok) { setStatus("error"); return; }
        const { userId } = await byEmail.json();
        if (!userId) { setStatus("error"); return; }

        const res = await fetch(`/api/user/links?lid=${userId}`);
        if (!res.ok) { setStatus("error"); return; }
        const data = await res.json();
        if (!data.google_connected) { setStatus("no_google"); return; }
        if (!data.sheet_url) { setStatus("no_sheet"); return; }
        setStatus("redirecting");
        window.location.href = data.sheet_url;
      } catch { setStatus("error"); }
    }

    resolve();
  }, [sessionStatus, session]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        {status === "loading" && (
          <>
            <div className="text-5xl mb-4 animate-pulse">📋</div>
            <p className="text-gray-600 font-medium">กำลังโหลด...</p>
          </>
        )}
        {status === "redirecting" && (
          <>
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-600 font-medium">กำลังเปิด Google Sheets...</p>
          </>
        )}
        {status === "no_google" && (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <p className="text-gray-800 font-semibold mb-2">ยังไม่ได้เชื่อมต่อ Google</p>
            <p className="text-gray-500 text-sm mb-4">กรุณาเชื่อมต่อ Google ที่หน้าตั้งค่าก่อนครับ</p>
            <a href="/settings" className="inline-block bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
              ไปหน้าตั้งค่า
            </a>
          </>
        )}
        {status === "no_sheet" && (
          <>
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-800 font-semibold mb-2">ยังไม่มี Google Sheet</p>
            <p className="text-gray-500 text-sm mb-4">ส่งสลิปแรกเพื่อสร้าง Sheet อัตโนมัติครับ</p>
            <a href="/home" className="inline-block bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
              กลับหน้าหลัก
            </a>
          </>
        )}
        {status === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <p className="text-gray-600">เกิดข้อผิดพลาด กรุณาลองใหม่</p>
            <a href="/home" className="inline-block mt-4 text-blue-500 text-sm underline">กลับหน้าหลัก</a>
          </>
        )}
      </div>
    </main>
  );
}
