"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

type InviteInfo = {
  adminEmail: string;
  status: string;
  ownerName: string;
} | null;

function AdminJoinInner() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const { data: session, status: sessionStatus } = useSession();

  const [inviteInfo, setInviteInfo]   = useState<InviteInfo>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [joining,     setJoining]     = useState(false);
  const [done,        setDone]        = useState(false);
  const [error,       setError]       = useState("");

  // Load invite info
  useEffect(() => {
    if (!code) { setLoadingInfo(false); return; }
    fetch(`/api/admin/join?code=${code}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setInviteInfo(d);
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูล"))
      .finally(() => setLoadingInfo(false));
  }, [code]);

  // Auto-join once session is ready and invite is loaded
  useEffect(() => {
    if (sessionStatus !== "authenticated" || !inviteInfo || done || joining || error) return;
    if (inviteInfo.status === "accepted") { setDone(true); return; }

    setJoining(true);
    fetch("/api/admin/join", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ inviteCode: code }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setDone(true);
      })
      .catch(() => setError("เกิดข้อผิดพลาด กรุณาลองใหม่"))
      .finally(() => setJoining(false));
  }, [sessionStatus, inviteInfo, done, joining, error, code]);

  if (!code) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔗</div>
          <p className="text-gray-400">ลิงก์ไม่ถูกต้อง</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🛡️</div>
          <h1 className="text-2xl font-bold text-white">เข้าร่วมเป็น Admin</h1>
          <p className="text-gray-400 text-sm mt-1">Vendee Finance Account Access</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
          {loadingInfo ? (
            <p className="text-center text-gray-400 py-4">กำลังโหลด...</p>
          ) : error ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-3">❌</div>
              <p className="text-red-400 text-sm font-medium">{error}</p>
              <p className="text-gray-500 text-xs mt-2">
                กรุณาติดต่อเจ้าของบัญชีเพื่อขอลิงก์ใหม่
              </p>
            </div>
          ) : done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="text-emerald-400 font-semibold text-lg">เข้าร่วมสำเร็จแล้ว!</p>
              {inviteInfo && (
                <p className="text-gray-400 text-sm mt-2">
                  คุณสามารถเข้าถึงบัญชีของ <span className="text-white font-medium">{inviteInfo.ownerName}</span> ได้แล้ว
                </p>
              )}
              <a
                href="/home"
                className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                🏠 ไปยัง Dashboard
              </a>
            </div>
          ) : inviteInfo ? (
            <>
              {/* Invite details */}
              <div className="bg-gray-700/50 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">เชิญโดย</p>
                <p className="text-white font-semibold">{inviteInfo.ownerName}</p>
                <p className="text-xs text-gray-400 mt-2 mb-1">อีเมลที่ได้รับเชิญ</p>
                <p className="text-gray-200 text-sm">{inviteInfo.adminEmail}</p>
              </div>

              <p className="text-gray-400 text-xs text-center leading-relaxed">
                เมื่อยืนยันแล้ว คุณจะสามารถดู Dashboard และจัดการรายการทั้งหมดของบัญชีนี้ได้
              </p>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                <p className="text-amber-400 text-xs leading-relaxed">
                  ⚠️ <span className="font-semibold">หมายเหตุ:</span> การซิงค์ข้อมูลไปยัง Google Sheets และ Drive
                  จะใช้บัญชี Google ของเจ้าของรหัส — เจ้าของต้องเชื่อมต่อ Google Drive ในหน้าตั้งค่าก่อน
                  จึงจะใช้งานฟีเจอร์นี้ได้
                </p>
              </div>

              {sessionStatus === "loading" || joining ? (
                <div className="text-center py-3">
                  <p className="text-gray-400 text-sm">
                    {joining ? "กำลังเชื่อมต่อบัญชี..." : "กำลังตรวจสอบ..."}
                  </p>
                </div>
              ) : sessionStatus === "authenticated" ? (
                <div className="space-y-3">
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex items-center gap-3">
                    {session?.user?.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <p className="text-xs text-gray-400">ลงชื่อเข้าใช้ด้วย</p>
                      <p className="text-white text-sm font-medium">{session?.user?.email}</p>
                    </div>
                  </div>
                  {session?.user?.email?.toLowerCase() !== inviteInfo.adminEmail.toLowerCase() ? (
                    <div>
                      <p className="text-amber-400 text-xs text-center mb-3">
                        ⚠️ กรุณาลงชื่อด้วย <strong>{inviteInfo.adminEmail}</strong>
                      </p>
                      <button
                        onClick={() => signIn("google", { callbackUrl: `/admin/join?code=${code}` }, { scope: "openid email profile" })}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-white text-gray-800 hover:bg-gray-100 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        เปลี่ยนบัญชี Google
                      </button>
                    </div>
                  ) : null /* auto-join triggered by useEffect */}
                </div>
              ) : (
                <button
                  onClick={() => signIn("google", { callbackUrl: `/admin/join?code=${code}` }, { scope: "openid email profile" })}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-white text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  ลงชื่อเข้าใช้ด้วย Google
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function AdminJoinPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🛡️</div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    }>
      <AdminJoinInner />
    </Suspense>
  );
}
