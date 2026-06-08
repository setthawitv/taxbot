"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VendeeLogo } from "@/components/icons";

function IntroPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("to") ?? "/home";

  useEffect(() => {
    // Intro page is now just a redirect to onboarding (Google login flow)
    router.replace(`/onboarding?redirect=${encodeURIComponent(redirectTo)}`);
  }, [router, redirectTo]);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4 animate-pulse"><VendeeLogo className="w-16 h-16" /></div>
        <p className="text-gray-400 text-sm">กำลังโหลด...</p>
      </div>
    </main>
  );
}

export default function IntroPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-pulse"><VendeeLogo className="w-16 h-16" /></div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    }>
      <IntroPageInner />
    </Suspense>
  );
}
