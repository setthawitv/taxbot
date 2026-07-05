"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function PaymentDoneInner() {
  const router = useRouter();
  const params = useSearchParams();
  const linkRef = params.get("linkRef");
  // For QR flow there is no linkRef — the settings page already confirmed the
  // charge, so this page just shows success. For card (payment-link) flow we
  // verify PAID via Beam before declaring success.
  const [state, setState] = useState<"checking" | "success" | "failed">(
    linkRef ? "checking" : "success"
  );

  useEffect(() => {
    if (!linkRef) {
      const t = setTimeout(() => router.replace("/home"), 3000);
      return () => clearTimeout(t);
    }

    let tries = 0;
    let done = false;
    const iv = setInterval(async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/payment/status?linkRef=${encodeURIComponent(linkRef)}`);
        const d = await res.json();
        if (d.status === "COMPLETED") {
          done = true;
          clearInterval(iv);
          setState("success");
          setTimeout(() => router.replace("/settings"), 2500);
        } else if (d.status === "FAILED") {
          done = true;
          clearInterval(iv);
          setState("failed");
        }
      } catch { /* keep polling */ }
      if (!done && tries >= 20) {
        clearInterval(iv);
        setState((s) => (s === "checking" ? "failed" : s));
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [linkRef, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        {state === "checking" && (
          <>
            <div className="text-6xl mb-4">⏳</div>
            <h1 className="text-2xl font-bold text-white mb-2">กำลังตรวจสอบการชำระเงิน...</h1>
            <p className="text-gray-400">รอสักครู่ อย่าเพิ่งปิดหน้านี้</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">ชำระเงินสำเร็จ!</h1>
            <p className="text-gray-400">กำลังกลับหน้าหลัก...</p>
          </>
        )}
        {state === "failed" && (
          <>
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-white mb-2">ยังไม่พบการชำระเงิน</h1>
            <p className="text-gray-400 mb-4">
              ถ้าคุณชำระเงินแล้ว ระบบจะอัปเดตแพ็กเกจให้อัตโนมัติภายในไม่กี่นาที
            </p>
            <button
              onClick={() => router.replace("/settings")}
              className="px-5 py-2.5 rounded-xl bg-white text-gray-900 text-sm font-semibold"
            >
              กลับหน้าตั้งค่า
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentDonePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <PaymentDoneInner />
    </Suspense>
  );
}
