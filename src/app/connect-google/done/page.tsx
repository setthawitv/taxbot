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

    const token = (session as typeof session & { accessToken?: string })?.accessToken;

    fetch("/api/user/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lineUserId: lid,
        googleAccessToken: token,
        googleEmail: session.user?.email,
        businessName: "ธุรกิจของฉัน",
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
            <p className="text-gray-400 text-sm mt-4 leading-relaxed">
              กลับไปที่ LINE แล้วตรวจสอบขั้นตอน<br />
              &quot;เชื่อมต่อ Google&quot; อีกครั้งได้เลยครับ
            </p>
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
