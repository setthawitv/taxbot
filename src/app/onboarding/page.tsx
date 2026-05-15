"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { initLiff, getLiffProfile } from "@/lib/liff";

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
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadState();
    const next = { ...saved };

    initLiff().then(async () => {
      setLiffReady(true);
      const profile = await getLiffProfile();
      if (profile) {
        setLineProfile(profile);
        next.lineConnected = true;
        setState({ ...next });
        saveState({ ...next });
      }
    }).catch(() => setLiffReady(true));

    if (session?.user) {
      next.googleConnected = true;
    }

    // Restore saved receipt preview
    const savedPreview = localStorage.getItem("taxbot_receipt_preview");
    if (savedPreview) setReceiptPreview(savedPreview);

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

  function handleReceiptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setReceiptPreview(base64);
      // Save for Day 3 (Claude API will read this)
      localStorage.setItem("taxbot_receipt_preview", base64);
      localStorage.setItem("taxbot_receipt_base64", base64.split(",")[1]);
      mark("firstReceiptUploaded");
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  const steps = [
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
        if (name?.trim()) {
          localStorage.setItem("taxbot_business_name", name.trim());
          mark("businessCreated");
        }
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
      sublabel: receiptPreview ? "ได้รับใบเสร็จแล้ว ✓" : "เลือกรูปสลิปหรือใบเสร็จ",
      action: () => fileInputRef.current?.click(),
      actionLabel: uploading ? "กำลังอัปโหลด..." : "เลือกรูป",
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

  async function finishOnboarding() {
    try {
      // Get LINE profile for user ID
      const profile = await getLiffProfile();
      const token = (session as { accessToken?: string } & typeof session)?.accessToken;

      if (profile && token) {
        await fetch("/api/user/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.userId,
            googleAccessToken: token,
            googleEmail: session?.user?.email,
            businessName: localStorage.getItem("taxbot_business_name") ?? "ธุรกิจของฉัน",
          }),
        });
      }
    } catch (err) {
      console.error("Failed to save user:", err);
    }

    document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-start px-4 py-10">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReceiptFile}
      />

      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤖</div>
          <h1 className="text-xl font-bold text-gray-800">ยินดีต้อนรับสู่ TaxBot</h1>
          <p className="text-gray-400 text-sm mt-1">ทำตามขั้นตอนเพื่อเริ่มใช้งาน</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="font-semibold text-gray-700">Onboarding checklist</span>
            <span className="text-gray-400 text-sm">{open ? "∧" : "∨"}</span>
          </button>

          <div className="h-1 bg-gray-100 mx-5 mb-1 rounded-full overflow-hidden">
            <div
              className="h-1 bg-green-400 rounded-full transition-all duration-500"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 text-right px-5 mb-3">
            {completed}/{steps.length} ขั้นตอน
          </p>

          {open && (
            <ul className="divide-y divide-gray-100">
              {steps.map((step, i) => {
                const done = !!state[step.key];
                const prevDone = i === 0 || !!state[steps[i - 1].key];
                const locked = !prevDone && !done;

                return (
                  <li key={step.key} className={`px-5 py-3 ${locked ? "opacity-40" : ""}`}>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm
                          ${done ? "bg-green-500 text-white" : "border-2 border-gray-300 text-transparent"}`}
                      >
                        {done ? "✓" : "○"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{step.sublabel}</p>
                      </div>

                      {!done && !locked && step.action && (
                        <button
                          onClick={step.action}
                          disabled={uploading && step.key === "firstReceiptUploaded"}
                          className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {step.actionLabel}
                        </button>
                      )}
                    </div>

                    {/* Receipt preview */}
                    {step.key === "firstReceiptUploaded" && receiptPreview && (
                      <div className="mt-3 ml-9">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={receiptPreview}
                          alt="receipt preview"
                          className="w-full max-h-48 object-contain rounded-xl border border-gray-200"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-center">
                          AI จะอ่านใบเสร็จนี้ในขั้นตอนถัดไป
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

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
