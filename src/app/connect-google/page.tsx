"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectGoogleInner() {
  const params = useSearchParams();
  const lid = params.get("lid") ?? "";
  // ext=1 means we're already in external browser — proceed with OAuth
  const isExternal = params.get("ext") === "1";
  const [status, setStatus] = useState<"checking" | "redirecting" | "open-external">("checking");

  useEffect(() => {
    if (!lid) return;

    const isLineBrowser = /Line\//i.test(navigator.userAgent);

    if (isLineBrowser && !isExternal) {
      // We're inside LINE browser — need to open in external browser first
      setStatus("open-external");

      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        import("@line/liff").then(({ default: liff }) => {
          liff.init({ liffId })
            .then(() => {
              liff.openWindow({
                url: `${window.location.origin}/connect-google?lid=${lid}&ext=1`,
                external: true,
              });
            })
            .catch(() => {
              // LIFF init failed — show manual instructions
            });
        });
      }
    } else {
      // Already in external browser (or ext=1) — trigger Google OAuth directly
      setStatus("redirecting");
      signIn("google", { callbackUrl: `/connect-google/done?lid=${lid}` });
    }
  }, [lid, isExternal]);

  if (status === "open-external") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="text-6xl mb-4">🌐</div>
          <h1 className="text-lg font-bold text-gray-800 mb-2">กำลังเปิด Browser ภายนอก</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            รอสักครู่... ระบบกำลังเปิด Safari/Chrome<br />
            เพื่อเชื่อมต่อ Google
          </p>
          <p className="text-xs text-gray-400">
            หากไม่เปิดอัตโนมัติ กรุณากดปุ่มด้านล่าง
          </p>
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}/connect-google?lid=${lid}&ext=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block bg-blue-500 text-white px-6 py-3 rounded-xl text-sm font-semibold"
          >
            เปิด Browser ภายนอก
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">🔄</div>
        <p className="text-gray-600 font-medium">กำลังเชื่อมต่อ Google...</p>
        <p className="text-gray-400 text-sm mt-2">กรุณารอสักครู่</p>
      </div>
    </main>
  );
}

export default function ConnectGooglePage() {
  return (
    <Suspense>
      <ConnectGoogleInner />
    </Suspense>
  );
}
