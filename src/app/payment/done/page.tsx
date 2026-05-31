"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentDonePage() {
  const router = useRouter();
  useEffect(() => {
    setTimeout(() => router.replace("/"), 3000);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">ชำระเงินสำเร็จ!</h1>
        <p className="text-gray-400">กำลังกลับหน้าหลัก...</p>
      </div>
    </div>
  );
}
