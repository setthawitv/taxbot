"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConnectGoogleDoneInner() {
  const { data: session, status } = useSession();
  const params = useSearchParams();
  const lid = params.get("lid") ?? "";
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !session || !lid || saved) return;

    const s = session as typeof session & { accessToken?: string; refreshToken?: string };

    fetch("/api/user/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId:           lid,
        googleAccessToken:    s.accessToken,
        googleRefreshToken:   s.refreshToken,
        googleEmail:          session.user?.email,
        businessName:         "ธุรกิจของฉัน",
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("save failed");
        return r.json();
      })
      .then(() => setSaved(true))
      .catch(() => setError("บันทึกไม่สำเร็จ กรุณาลองใหม่"));
  }, [status, session, lid, saved]);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">⏳</div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        {saved ? (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-800 mb-2">เชื่อมต่อสำเร็จ!</h1>
            <p className="text-gray-500 text-sm mb-1">
              {session?.user?.email}
            </p>
            <a
              href={`https://line.me/R/ti/p/${process.env.NEXT_PUBLIC_LINE_OA_ID ?? "@074ebvus"}`}
              className="mt-6 inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: "#06C755" }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
              </svg>
              กลับไปที่ LINE
            </a>
          </>
        ) : error ? (
          <>
            <div className="text-5xl mb-4">❌</div>
            <p className="text-red-500 font-medium">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm text-blue-500 underline"
            >
              ลองใหม่
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4 animate-pulse">💾</div>
            <p className="text-gray-600">กำลังบันทึกข้อมูล...</p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ConnectGoogleDonePage() {
  return (
    <Suspense>
      <ConnectGoogleDoneInner />
    </Suspense>
  );
}
