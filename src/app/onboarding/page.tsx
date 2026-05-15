"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { initLiff, getLiffProfile, isInLineClient } from "@/lib/liff";

// ─── Types ─────────────────────────────────────────────────────────────────────
type LiffProfile = { userId: string; displayName: string; pictureUrl?: string };
type BusinessType = "individual" | "partnership" | "company";

// ─── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const labels = ["ข้อมูลส่วนตัว", "สร้างธุรกิจ", "เชื่อมต่อ Google"];
  return (
    <div className="flex items-center justify-center gap-0 w-full mb-6">
      {labels.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <div key={num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                  ${done ? "bg-gray-900 border-gray-900 text-white"
                    : active ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-300 text-gray-400"}`}
              >
                {done ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? "text-gray-800 font-semibold" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 rounded ${num < step ? "bg-gray-900" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 – Personal info ────────────────────────────────────────────────────
function Step1({
  profile,
  firstName, lastName,
  onFirstName, onLastName,
  onNext,
}: {
  profile: LiffProfile | null;
  firstName: string; lastName: string;
  onFirstName: (v: string) => void; onLastName: (v: string) => void;
  onNext: () => void;
}) {
  const canProceed = firstName.trim() && lastName.trim();
  return (
    <div className="flex flex-col gap-5">
      {/* LINE profile card */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">LINE</p>
        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100">
          {profile?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.pictureUrl} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-lg">👤</div>
          )}
          <span className="flex-1 font-medium text-gray-800">
            {profile?.displayName ?? "กำลังโหลด..."}
          </span>
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>
        </div>
      </div>

      {/* First name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อ</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstName(e.target.value)}
          placeholder="กรอกชื่อ (ภาษาไทยหรืออังกฤษ)"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Last name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">นามสกุล</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => onLastName(e.target.value)}
          placeholder="กรอกนามสกุล (ภาษาไทยหรืออังกฤษ)"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full bg-gray-900 text-white font-semibold py-3.5 rounded-2xl mt-2 hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ไปสร้างธุรกิจ
      </button>
    </div>
  );
}

// ─── Step 2 – Business setup ───────────────────────────────────────────────────
function Step2({
  businessType, businessName, phone, vatRegistered,
  onBusinessType, onBusinessName, onPhone, onVat,
  onNext, onBack,
}: {
  businessType: BusinessType; businessName: string; phone: string; vatRegistered: boolean;
  onBusinessType: (v: BusinessType) => void; onBusinessName: (v: string) => void;
  onPhone: (v: string) => void; onVat: (v: boolean) => void;
  onNext: () => void; onBack: () => void;
}) {
  const canProceed = businessName.trim() && phone.trim();
  return (
    <div className="flex flex-col gap-5">
      {/* Business type */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">ประเภทธุรกิจ <span className="text-red-500">*</span></label>
        <select
          value={businessType}
          onChange={(e) => onBusinessType(e.target.value as BusinessType)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          <option value="individual">บุคคลธรรมดา / ฟรีแลนซ์</option>
          <option value="partnership">ห้างหุ้นส่วน</option>
          <option value="company">บริษัทจำกัด</option>
        </select>
      </div>

      {/* VAT status */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">สถานะการจด VAT <span className="text-red-500">*</span></label>
        <div className="flex gap-4">
          {[{ label: "จด VAT แล้ว", value: true }, { label: "ยังไม่จด VAT", value: false }].map((opt) => (
            <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => onVat(opt.value)}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer
                  ${vatRegistered === opt.value ? "border-blue-600" : "border-gray-300"}`}
              >
                {vatRegistered === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </div>
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Business name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          ชื่อธุรกิจ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => onBusinessName(e.target.value)}
          placeholder="เช่น ร้านค้าออนไลน์ของฉัน"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          เบอร์โทรติดต่อ <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhone(e.target.value)}
          placeholder="0XX-XXX-XXXX"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
        />
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button onClick={onBack} className="text-sm font-medium text-blue-600 flex-shrink-0">
          ย้อนกลับ
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-gray-900 text-white font-semibold py-3.5 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          สร้างธุรกิจ
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 – Google connect ───────────────────────────────────────────────────
function Step3({
  googleEmail, connected, polling,
  onConnect, onFinish, onBack,
}: {
  googleEmail: string | null; connected: boolean; polling: boolean;
  onConnect: () => void; onFinish: () => void; onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Feature list */}
      <div className="bg-blue-50 rounded-2xl p-4 space-y-2">
        <p className="font-semibold text-gray-800 mb-3">เชื่อมต่อ Google เพื่อ:</p>
        {[
          "บันทึกรายรับ-รายจ่ายลง Google Sheets อัตโนมัติ",
          "ดาวน์โหลดข้อมูลเป็น Excel ได้ตลอดเวลา",
          "สำรองข้อมูลใน Google Drive ของคุณ",
        ].map((f) => (
          <div key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-green-500 font-bold mt-0.5">✓</span>
            <span>{f}</span>
          </div>
        ))}
      </div>

      {connected ? (
        // Connected state
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm flex-shrink-0">✓</div>
          <div>
            <p className="text-sm font-semibold text-green-800">เชื่อมต่อสำเร็จ</p>
            <p className="text-xs text-green-600">{googleEmail}</p>
          </div>
        </div>
      ) : (
        // Connect button
        <button
          onClick={onConnect}
          disabled={polling}
          className="w-full flex items-center justify-center gap-3 border-2 border-gray-300 rounded-2xl py-3.5 hover:border-gray-500 active:scale-95 transition-all disabled:opacity-60"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span className="font-semibold text-gray-700">
            {polling ? "รอการเชื่อมต่อ..." : "เชื่อมต่อ Google Account"}
          </span>
        </button>
      )}

      {polling && (
        <p className="text-center text-xs text-gray-400 animate-pulse">
          กรุณาเข้าสู่ระบบใน browser ที่เปิดขึ้น แล้วกลับมาที่หน้านี้
        </p>
      )}

      <div className="flex items-center gap-3 mt-2">
        <button onClick={onBack} className="text-sm font-medium text-blue-600 flex-shrink-0">
          ย้อนกลับ
        </button>
        <button
          onClick={onFinish}
          disabled={!connected}
          className="flex-1 bg-gray-900 text-white font-semibold py-3.5 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          เริ่มใช้งาน TaxBot →
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [liffProfile, setLiffProfile] = useState<LiffProfile | null>(null);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Step 2
  const [businessType, setBusinessType] = useState<BusinessType>("individual");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [vatRegistered, setVatRegistered] = useState(false);

  // Step 3
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [pollingGoogle, setPollingGoogle] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initLiff()
      .then(async () => {
        const profile = await getLiffProfile();
        if (profile) {
          setLiffProfile(profile);
          // Auto-check if Google already linked
          const res = await fetch(`/api/user/status?lineUserId=${profile.userId}`);
          const data = await res.json();
          if (data.connected) {
            setGoogleConnected(true);
            setGoogleEmail(data.email);
          }
        }
      })
      .catch(() => {});

    if (session?.user?.email) {
      setGoogleConnected(true);
      setGoogleEmail(session.user.email);
    }
  }, [session]);

  useEffect(() => {
    return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); };
  }, []);

  function startGooglePolling(lineUserId: string) {
    setPollingGoogle(true);
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/user/status?lineUserId=${lineUserId}`);
        const data = await res.json();
        if (data.connected) {
          clearInterval(pollTimerRef.current!);
          setPollingGoogle(false);
          setGoogleEmail(data.email);
          setGoogleConnected(true);
        }
      } catch { /* keep polling */ }
    }, 3000);

    setTimeout(() => {
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); setPollingGoogle(false); }
    }, 5 * 60 * 1000);
  }

  async function connectGoogle() {
    if (isInLineClient()) {
      const userId = liffProfile?.userId;
      if (!userId) return;
      const liffModule = await import("@line/liff");
      liffModule.default.openWindow({
        url: `${window.location.origin}/connect-google?lid=${userId}`,
        external: true,
      });
      startGooglePolling(userId);
    } else {
      signIn("google", { callbackUrl: "/onboarding" });
    }
  }

  async function finish() {
    try {
      const token = (session as typeof session & { accessToken?: string })?.accessToken;
      await fetch("/api/user/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: liffProfile?.userId,
          firstName,
          lastName,
          businessType,
          businessName,
          phone,
          vatRegistered,
          googleEmail,
          googleAccessToken: token ?? null,
        }),
      });
    } catch (err) {
      console.error("Failed to save user:", err);
    }
    document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🤖</div>
        <h1 className="text-xl font-bold text-gray-800">ยินดีต้อนรับสู่ TaxBot</h1>
        <p className="text-gray-400 text-sm mt-1">เริ่มใช้งานฟรีได้ทันที! เพียง 3 ขั้นตอนง่าย ๆ</p>
      </div>

      <StepBar step={step} />

      {step === 1 && (
        <Step1
          profile={liffProfile}
          firstName={firstName} lastName={lastName}
          onFirstName={setFirstName} onLastName={setLastName}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          businessType={businessType} businessName={businessName}
          phone={phone} vatRegistered={vatRegistered}
          onBusinessType={setBusinessType} onBusinessName={setBusinessName}
          onPhone={setPhone} onVat={setVatRegistered}
          onNext={() => setStep(3)} onBack={() => setStep(1)}
        />
      )}
      {step === 3 && (
        <Step3
          googleEmail={googleEmail} connected={googleConnected} polling={pollingGoogle}
          onConnect={connectGoogle} onFinish={finish} onBack={() => setStep(2)}
        />
      )}
    </main>
  );
}
