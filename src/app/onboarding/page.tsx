"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { initLiff, getLiffProfile } from "@/lib/liff";

type Step = {
  key: string;
  label: string;
  sublabel?: string;
  action?: () => void;
  actionLabel?: string;
};

const STORAGE_KEY = "taxbot_onboarding";

function loadState(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(true);
  const [lineProfile, setLineProfile] = useState<{ displayName: string } | null>(null);
  const [liffReady, setLiffReady] = useState(false);

  useEffect(() => {
    const saved = loadState();
    const next = { ...saved };

    // Init LIFF, then check login state (works both in LINE app and desktop browser)
    initLiff().then(async () => {
      setLiffReady(true);
      const profile = await getLiffProfile(); // triggers liff.login() if not logged in
      if (profile) {
        setLineProfile(profile);
        next.lineConnected = true;
        setState({ ...next });
        saveState({ ...next });
      }
    }).catch(() => setLiffReady(true));

    // Auto-complete Google step if NextAuth session exists
    if (session?.user) {
      next.googleConnected = true;
    }

    setState(next);
    saveState(next);
  }, [session]);

  function mark(key: string) {
    setState((prev) => {
      const next = { ...prev, [key]: true };
      saveState(next);
      return next;
    });
  }

  const steps: Step[] = [
    {
      key: "lineConnected",
      label: "เชื่อมต่อ LINE",
      sublabel: lineProfile ? `สวัสดี ${lineProfile.displayName}` : "กำลังเชื่อมต่อ...",
      action: liffReady && !state.lineConnected
        ? () => initLiff().then(() => getLiffProfile())
        : undefined,
      actionLabel: "เข้าสู่ระบบ LINE",
    },
    {
      key: "businessCreated",
      label: "สร้างธุรกิจ",
      sublabel: "ตั้งชื่อธุรกิจของคุณ",
      action: () => {
        const name = prompt("ชื่อธุรกิจของคุณ:");
        if (name?.trim()) mark("businessCreated");
      },
      actionLabel: "สร้างเลย",
    },
    {
      key: "googleConnected",
      label: "เชื่อมต่อ Google",
      sublabel: session?.user?.email ?? "Drive + Sheets",
      action: () => signIn("google", { callbackUrl: "/onboarding" }),
      actionLabel: "เชื่อมต่อ",
    },
    {
      key: "firstReceiptUploaded",
      label: "อัปโหลดใบเสร็จแรก",
      sublabel: "ส่งรูปสลิปใน LINE Chat",
      action: () => mark("firstReceiptUploaded"),
      actionLabel: "ทำแล้ว",
    },
    {
      key: "signatureAdded",
      label: "ใส่ลายเซ็นรับรองใบแนบใบเสร็จ",
      sublabel: "รับรองเอกสารด้วยลายเซ็น",
      action: () => mark("signatureAdded"),
      actionLabel: "ทำแล้ว",
    },
    {
      key: "sheetChecked",
      label: "เช็ครายการใน Sheet",
      sublabel: "ตรวจสอบข้อมูลใน Google Sheet",
      action: () => mark("sheetChecked"),
      actionLabel: "เช็คแล้ว",
    },
  ];

  const completed = steps.filter((s) => state[s.key]).length;
  const allDone = completed === steps.length;

  function finishOnboarding() {
    document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-xl font-bold text-gray-800">ยินดีต้อนรับสู่ TaxBot</h1>
          <p className="text-gray-400 text-sm mt-1">ทำตามขั้นตอนเพื่อเริ่มใช้งาน</p>
        </div>

        {/* Checklist card */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

          {/* Card header */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="font-semibold text-gray-700">Onboarding checklist</span>
            <span className="text-gray-400 text-sm">{open ? "∧" : "∨"}</span>
          </button>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100 mx-5 mb-1 rounded-full overflow-hidden">
            <div
              className="h-1 bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right px-5 mb-3">
            {completed}/{steps.length} ขั้นตอน
          </p>

          {/* Steps */}
          {open && (
            <ul className="divide-y divide-gray-100">
              {steps.map((step, i) => {
                const done = !!state[step.key];
                const prevDone = i === 0 || !!state[steps[i - 1].key];
                const locked = !prevDone && !done;

                return (
                  <li
                    key={step.key}
                    className={`flex items-center gap-3 px-5 py-3 ${locked ? "opacity-40" : ""}`}
                  >
                    {/* Icon */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm
                        ${done ? "bg-green-500 text-white" : "border-2 border-gray-300 text-transparent"}`}
                    >
                      {done ? "✓" : "○"}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {step.label}
                      </p>
                      {step.sublabel && (
                        <p className="text-xs text-gray-400 truncate">{step.sublabel}</p>
                      )}
                    </div>

                    {/* Action */}
                    {!done && !locked && step.action && (
                      <button
                        onClick={step.action}
                        className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0"
                      >
                        {step.actionLabel}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Done button */}
        {allDone && (
          <button
            onClick={finishOnboarding}
            className="mt-6 w-full bg-green-500 text-white font-semibold py-3 rounded-2xl hover:bg-green-600 transition-colors"
          >
            เริ่มใช้งาน TaxBot →
          </button>
        )}
      </div>
    </main>
  );
}
