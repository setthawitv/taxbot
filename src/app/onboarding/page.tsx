"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { VendeeLogo } from "@/components/icons";

// ─── Types ─────────────────────────────────────────────────────────────────────
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
                  ${done ? "bg-[#0A192F] border-[#0A192F] text-white"
                    : active ? "bg-[#0A192F] border-[#0A192F] text-white"
                    : "bg-white border-gray-300 text-gray-400"}`}
              >
                {done ? "✓" : num}
              </div>
              <span className={`text-xs mt-1 whitespace-nowrap ${active ? "text-gray-800 font-semibold" : "text-gray-400"}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`h-0.5 w-8 mx-1 mb-4 rounded ${num < step ? "bg-[#0A192F]" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 – Personal info ────────────────────────────────────────────────────
function Step1({
  firstName, lastName,
  onFirstName, onLastName,
  onNext,
}: {
  firstName: string; lastName: string;
  onFirstName: (v: string) => void; onLastName: (v: string) => void;
  onNext: () => void;
}) {
  const canProceed = firstName.trim() && lastName.trim();
  return (
    <div className="flex flex-col gap-5">

      {/* First name */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">ชื่อ</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => onFirstName(e.target.value)}
          placeholder="กรอกชื่อ (ภาษาไทยหรืออังกฤษ)"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F] placeholder-gray-400"
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
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F] placeholder-gray-400"
        />
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="w-full bg-[#0A192F] text-white font-semibold py-3.5 rounded-2xl mt-2 hover:bg-[#0d2240] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A192F]"
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
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F] placeholder-gray-400"
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
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A192F] placeholder-gray-400"
        />
      </div>

      <div className="flex items-center gap-3 mt-2">
        <button onClick={onBack} className="text-sm font-medium text-blue-600 flex-shrink-0">
          ย้อนกลับ
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex-1 bg-[#0A192F] text-white font-semibold py-3.5 rounded-2xl hover:bg-[#0d2240] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          สร้างธุรกิจ
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 – Google connect ───────────────────────────────────────────────────
function Step3({
  googleEmail, connected, polling, googleOnly,
  onConnect, onFinish, onBack,
  saving, saveError,
}: {
  googleEmail: string | null; connected: boolean; polling: boolean; googleOnly?: boolean;
  onConnect: () => void; onFinish: () => void; onBack: () => void;
  saving: boolean; saveError: string;
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
      ) : !googleOnly ? (
        // Connect button — only shown for LINE users who haven't connected Google yet
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
      ) : null}

      {polling && (
        <p className="text-center text-xs text-gray-400 animate-pulse">
          กรุณาเข้าสู่ระบบใน browser ที่เปิดขึ้น แล้วกลับมาที่หน้านี้
        </p>
      )}

      {saveError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          {saveError}
        </div>
      )}

      <div className="flex items-center gap-3 mt-2">
        <button onClick={onBack} disabled={saving}
          className="text-sm font-medium text-blue-600 flex-shrink-0 disabled:opacity-40">
          ย้อนกลับ
        </button>
        <button
          onClick={onFinish}
          disabled={!connected || saving}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0A192F] text-white font-semibold py-3.5 rounded-2xl hover:bg-[#0d2240] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              กำลังตั้งค่าบัญชี...
            </>
          ) : (
            <>เริ่มใช้งาน Vendee Finance →</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [checking, setChecking] = useState(true);

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
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState("");

  // unused ref kept to satisfy Step3 polling prop
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { return () => { if (pollTimerRef.current) clearInterval(pollTimerRef.current); }; }, []);

  // ── Check Google session ──────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;

    async function checkUser() {
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.userId) {
              const statusRes = await fetch(`/api/user/status?userId=${d.userId}`);
              const status = await statusRes.json();
              if (status.onboarded) {
                document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";
                router.replace("/home");
                return;
              }
              // Pre-fill saved data
              if (status.profile) {
                const p = status.profile;
                if (p.firstName)    setFirstName(p.firstName);
                if (p.lastName)     setLastName(p.lastName);
                if (p.businessName) setBusinessName(p.businessName);
                if (p.businessType) setBusinessType(p.businessType);
                if (p.phone)        setPhone(p.phone);
                setVatRegistered(p.vatRegistered ?? false);
              }
            }
          }
        } catch { /* ignore */ }
        setGoogleConnected(true);
        setGoogleEmail(session.user.email);
      }
      setChecking(false);
    }

    checkUser();
  }, [sessionStatus, session, router]);

  async function connectGoogle() {
    signIn("google", { callbackUrl: "/onboarding" });
  }

  async function finish() {
    if (saving) return;
    setSaving(true);
    setSaveError("");

    const lineUserId = googleEmail
      ? `google_${googleEmail.toLowerCase().replace(/[@.+]/g, "_")}`
      : null;

    try {
      const s = session as typeof session & { accessToken?: string; refreshToken?: string };
      const res = await fetch("/api/user/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId,
          firstName,
          lastName,
          businessType,
          businessName,
          phone,
          vatRegistered,
          googleEmail,
          googleAccessToken:  s?.accessToken  ?? null,
          googleRefreshToken: s?.refreshToken ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("[onboarding] /api/user/save failed:", res.status, data);
        setSaveError(data.error || `บันทึกไม่สำเร็จ (${res.status}) — ระบบจะพาเข้าหน้าหลักให้`);
      }
    } catch (err) {
      console.error("Failed to save user:", err);
      setSaveError("เครือข่ายขัดข้อง — ระบบจะพาเข้าหน้าหลักให้");
    }
    document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";
    router.push("/home");
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4 animate-pulse"><VendeeLogo className="w-16 h-16" /></div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    );
  }

  if (!googleConnected) {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-4"><VendeeLogo className="w-20 h-20" /></div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Vendee Finance</h1>
        <p className="text-gray-400 text-sm mb-8">เข้าสู่ระบบเพื่อเริ่มใช้งาน</p>
        <div className="w-full max-w-xs flex flex-col gap-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold py-4 rounded-2xl text-sm active:scale-95 transition-all hover:border-gray-400 shadow-sm"
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            เข้าสู่ระบบด้วย Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">🤖</div>
        <h1 className="text-xl font-bold text-gray-800">ยินดีต้อนรับสู่ Vendee Finance</h1>
        <p className="text-gray-400 text-sm mt-1">เริ่มใช้งานฟรีได้ทันที! เพียง 3 ขั้นตอนง่าย ๆ</p>
      </div>

      <StepBar step={step} />

      {step === 1 && (
        <Step1
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
          googleEmail={googleEmail} connected={googleConnected} polling={false}
          onConnect={connectGoogle} onFinish={finish} onBack={() => setStep(2)}
          googleOnly={true}
          saving={saving} saveError={saveError}
        />
      )}
    </main>
  );
}
