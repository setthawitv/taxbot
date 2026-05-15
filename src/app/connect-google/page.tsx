"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectGoogleInner() {
  const params = useSearchParams();
  const lid = params.get("lid") ?? "";

  useEffect(() => {
    if (lid) {
      // Redirect to Google OAuth; callback will land on done page with lid intact
      signIn("google", { callbackUrl: `/connect-google/done?lid=${lid}` });
    }
  }, [lid]);

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
