"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconHelp,
  IconIncome, IconExpense, IconTax,
  IconGoogleSheets, IconGoogleDrive,
  IconScan, IconShield, IconCheckCircle, IconWave, IconLightbulb, IconUser, IconRocket,
} from "@/components/icons";
import AppLayout from "@/components/AppLayout";
import type { ComponentType } from "react";

// ── Tour steps ────────────────────────────────────────────────────────────────
type TourStep = {
  Icon:  ComponentType<{ className?: string }>;
  tint:  "blue" | "emerald" | "rose" | "purple" | "amber" | "indigo";
  title: string;
  desc:  string;
  cta:   string;
  tip:   string | null;
};

const TOUR_STEPS: TourStep[] = [
  { Icon: IconWave,         tint: "amber",
    title: "ยินดีต้อนรับสู่ Vendee Finance",
    desc:  "Vendee Finance ช่วยให้คุณจัดการรายรับ-รายจ่าย และคำนวณภาษีได้ง่าย โดยไม่ต้องมีความรู้บัญชี มาดูแต่ละฟีเจอร์กันเลย",
    cta:   "เริ่มเลย",  tip: null },
  { Icon: IconIncome,       tint: "emerald",
    title: "รายรับ — บันทึกรายได้",
    desc:  "นำเข้ายอดขายจาก TikTok Shop, Shopee, Lazada ได้โดยอัปโหลดไฟล์ Excel จากแพลตฟอร์ม หรือบันทึกรายรับเองได้ทันที",
    cta:   "ถัดไป",     tip: "ไปที่ รายรับ → นำเข้า → เลือกไฟล์ Excel จากแพลตฟอร์ม" },
  { Icon: IconExpense,      tint: "rose",
    title: "รายจ่าย — บันทึกค่าใช้จ่าย",
    desc:  "บันทึกค่าใช้จ่ายทุกรายการ — ค่าสินค้า ค่าขนส่ง ค่าโฆษณา หรือสแกนใบเสร็จด้วย AI ให้อ่านและบันทึกอัตโนมัติ",
    cta:   "ถัดไป",     tip: "กดปุ่ม สแกน แล้วถ่ายรูปใบเสร็จ — AI จะอ่านยอดและบันทึกให้เลย" },
  { Icon: IconScan,         tint: "purple",
    title: "สแกนใบเสร็จด้วย AI",
    desc:  "ถ่ายรูปสลิปโอนเงินหรืออัปโหลดใบเสร็จ — AI จะอ่านยอดเงิน ชื่อร้านค้า วันที่ และบันทึกให้อัตโนมัติ",
    cta:   "ถัดไป",     tip: "ใช้ได้ทั้งกล้องถ่ายสด และเลือกจากคลังรูปภาพ" },
  { Icon: IconTax,          tint: "blue",
    title: "ภาษี — คำนวณอัตโนมัติ",
    desc:  "ระบบคำนวณภาษีบุคคลธรรมดา/นิติบุคคลให้อัตโนมัติจากรายรับ-รายจ่าย พร้อมแนะนำวิธีหักค่าใช้จ่ายที่ประหยัดภาษีสูงสุด",
    cta:   "ถัดไป",     tip: "เปรียบเทียบ 2 วิธีคำนวณ — เลือกแบบที่ประหยัดกว่า" },
  { Icon: IconGoogleSheets, tint: "emerald",
    title: "Google Sheets — ซิงค์อัตโนมัติ",
    desc:  "ทุกรายการที่บันทึกจะซิงค์ไป Google Sheets ของคุณอัตโนมัติ แชร์ให้นักบัญชีหรือดาวน์โหลดรายงานได้ทุกเมื่อ",
    cta:   "ถัดไป",     tip: "ไปที่ ตั้งค่า → เชื่อมต่อ Google เพื่อเปิดใช้งาน" },
  { Icon: IconShield,       tint: "indigo",
    title: "แชร์ให้ทีมงาน",
    desc:  "เพิ่ม Admin ด้วย Google Email เพื่อให้เข้าถึง Dashboard เต็มที่ หรือสร้างลิงก์ Staff ให้พนักงานบันทึกรายจ่ายโดยไม่ต้อง login",
    cta:   "ถัดไป",     tip: "ไปที่ ตั้งค่า → ส่วน Admin เพื่อเพิ่มผู้ดูแลร่วม" },
  { Icon: IconCheckCircle,  tint: "emerald",
    title: "พร้อมเริ่มใช้งานแล้ว",
    desc:  "คุณรู้จักทุกฟีเจอร์แล้ว เริ่มต้นด้วยการบันทึกรายจ่ายแรก หรือนำเข้าไฟล์ยอดขายจากแพลตฟอร์มได้เลย",
    cta:   "เริ่มใช้งาน", tip: null },
];

const TINT_CLASSES: Record<TourStep["tint"], { bg: string; ring: string; icon: string; btn: string }> = {
  blue:    { bg: "bg-blue-50",    ring: "ring-blue-100",    icon: "text-blue-600",    btn: "bg-blue-600 hover:bg-blue-700"       },
  emerald: { bg: "bg-emerald-50", ring: "ring-emerald-100", icon: "text-emerald-600", btn: "bg-emerald-600 hover:bg-emerald-700" },
  rose:    { bg: "bg-rose-50",    ring: "ring-rose-100",    icon: "text-rose-600",    btn: "bg-rose-600 hover:bg-rose-700"       },
  purple:  { bg: "bg-purple-50",  ring: "ring-purple-100",  icon: "text-purple-600",  btn: "bg-purple-600 hover:bg-purple-700"   },
  amber:   { bg: "bg-amber-50",   ring: "ring-amber-100",   icon: "text-amber-600",   btn: "bg-amber-600 hover:bg-amber-700"     },
  indigo:  { bg: "bg-indigo-50",  ring: "ring-indigo-100",  icon: "text-indigo-600",  btn: "bg-indigo-600 hover:bg-indigo-700"   },
};

function TourModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = TOUR_STEPS[step];
  const isLast  = step === TOUR_STEPS.length - 1;
  const tint    = TINT_CLASSES[current.tint];
  const Ico     = current.Icon;

  function next() {
    if (isLast) { onClose(); return; }
    setStep((s) => s + 1);
  }

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className={`h-full transition-all duration-300 ${tint.btn.split(" ")[0]}`}
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 space-y-5">
          {/* Step counter */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium tracking-wide">
              {String(step + 1).padStart(2, "0")} / {String(TOUR_STEPS.length).padStart(2, "0")}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm font-medium transition-colors">
              ข้าม
            </button>
          </div>

          {/* Content */}
          <div className="text-center space-y-4 py-2">
            <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${tint.bg} ring-1 ${tint.ring}`}>
              <Ico className={`w-8 h-8 ${tint.icon}`} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{current.title}</h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">{current.desc}</p>
          </div>

          {/* Tip box */}
          {current.tip && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <IconLightbulb className={`w-4 h-4 ${tint.icon} flex-shrink-0 mt-0.5`} />
              <p className="text-gray-600 text-xs leading-relaxed">{current.tip}</p>
            </div>
          )}

          {/* Dots */}
          <div className="flex justify-center gap-1.5 pt-1">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === step
                    ? `w-6 h-1.5 ${tint.btn.split(" ")[0]}`
                    : "w-1.5 h-1.5 bg-gray-200 hover:bg-gray-300"
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                ย้อนกลับ
              </button>
            )}
            <button
              onClick={next}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold text-white transition-colors ${tint.btn}`}
            >
              {current.cta}
              {isLast ? <IconRocket className="w-4 h-4" /> : <span className="text-base leading-none">→</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const MONTH_TH = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

const fmtInt = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const fmt    = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type UserInfo = {
  displayName:    string;
  pictureUrl:     string;
  businessName:   string;
  googleConnected: boolean;
  role?:          "owner" | "admin";
};

type Stats = {
  monthIncome:   number;
  yearIncome:    number;
  monthExpense:  number;
  yearExpense:   number;
  estimatedTax:  number;
};

type Links = {
  sheetUrl: string | null;
  driveUrl: string | null;
};


function StatCard({
  label, value, sub, color, loading,
}: {
  label: string; value: string; sub?: string;
  color: "emerald" | "blue" | "rose" | "amber";
  loading: boolean;
}) {
  const colors = {
    emerald: { border: "border-emerald-100", text: "text-emerald-600", bg: "bg-emerald-50" },
    blue:    { border: "border-blue-100",    text: "text-blue-600",    bg: "bg-blue-50"    },
    rose:    { border: "border-rose-100",    text: "text-rose-600",    bg: "bg-rose-50"    },
    amber:   { border: "border-amber-100",   text: "text-amber-600",   bg: "bg-amber-50"   },
  }[color];

  return (
    <div className={`rounded-2xl border ${colors.border} ${colors.bg} p-4`}>
      <p className="text-xs text-gray-400 mb-1 truncate">{label}</p>
      {loading ? (
        <div className="h-6 bg-white/70 rounded animate-pulse w-3/4" />
      ) : (
        <p className={`text-lg font-bold ${colors.text} leading-tight`}>{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Donut Chart ──────────────────────────────────────────────────────────────
function PieChart({ income, expense }: { income: number; expense: number }) {
  const inc   = Number(income)  || 0;
  const exp   = Number(expense) || 0;
  const total = inc + exp;

  const r           = 28;
  const circumf     = 2 * Math.PI * r;
  const incDash     = total > 0 ? (inc / total) * circumf : 0;
  const expDash     = total > 0 ? (exp / total) * circumf : 0;
  // rotate so income starts at top (-90°)
  const incOffset   = circumf * 0.25;
  const expOffset   = incOffset - incDash;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <svg viewBox="0 0 80 80" className="w-40 h-40">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        </svg>
        <p className="text-xs text-gray-400">ยังไม่มีข้อมูล</p>
      </div>
    );
  }

  return (
    <svg viewBox="0 0 80 80" className="w-40 h-40 drop-shadow-sm">
      {/* background ring */}
      <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="12" />
      {/* income arc (green) */}
      {incDash > 0 && (
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke="#10B981"
          strokeWidth="12"
          strokeDasharray={`${incDash} ${circumf - incDash}`}
          strokeDashoffset={incOffset}
          strokeLinecap="butt"
        />
      )}
      {/* expense arc (rose) */}
      {expDash > 0 && (
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke="#F43F5E"
          strokeWidth="12"
          strokeDasharray={`${expDash} ${circumf - expDash}`}
          strokeDashoffset={expOffset}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

export default function Home() {
  const [lineUserId,   setLineUserId]   = useState("");
  const [authReady,    setAuthReady]    = useState(false);
  const [userInfo,     setUserInfo]     = useState<UserInfo | null>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [links,        setLinks]        = useState<Links>({ sheetUrl: null, driveUrl: null });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showTour,      setShowTour]      = useState(false);
  const [selectedYear,  setSelectedYear]  = useState(CURRENT_YEAR);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);

  const { data: session, status: sessionStatus } = useSession();

  // Auto-show tour once for new users
  useEffect(() => {
    const seen = localStorage.getItem("taxbot_tour_done");
    if (!seen) setShowTour(true);
  }, []);

  function closeTour() {
    setShowTour(false);
    localStorage.setItem("taxbot_tour_done", "1");
  }

  // ── Resolve user ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === "loading") return;
    async function resolveUser() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (liffId) {
        try {
          const { default: liff } = await import("@line/liff");
          await liff.init({ liffId });
          // If opened in LINE browser but not via LIFF URL → redirect to LIFF URL for auth
          if (!liff.isLoggedIn() && !liff.isInClient() && /Line\//i.test(navigator.userAgent)) {
            window.location.replace(`https://liff.line.me/${liffId}`);
            return;
          }
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            setLineUserId(p.userId);
            setUserInfo({ displayName: p.displayName, pictureUrl: p.pictureUrl ?? "", businessName: "", googleConnected: false });
            // Save latest LINE profile to DB in background
            fetch("/api/user/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lineUserId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl }),
            }).catch(() => {});
            setAuthReady(true);
            return;
          }
          // Inside LINE app but not logged in → force LIFF login
          if (liff.isInClient()) {
            liff.login();
            return;
          }
        } catch { /* not in LINE */ }
      }
      if (session?.user?.email) {
        try {
          const res = await fetch("/api/user/by-email");
          if (res.ok) {
            const d = await res.json();
            if (d.lineUserId) {
              setLineUserId(d.lineUserId);
              setUserInfo({
                displayName:    session.user.name ?? session.user.email ?? "",
                pictureUrl:     session.user.image ?? "",
                businessName:   "",
                googleConnected: true,
                role:           d.role ?? "owner",
              });
            }
          }
        } catch { /* ignore */ }
      }
      setAuthReady(true);
    }
    resolveUser();
  }, [sessionStatus, session]);

  // ── Fetch all dashboard data ──────────────────────────────────────────────
  useEffect(() => {
    if (!authReady || !lineUserId) { if (authReady) setLoadingStats(false); return; }
    setLoadingStats(true);
    const uid = lineUserId;
    const yr  = selectedYear;
    const mo  = selectedMonth;

    Promise.all([
      fetch(`/api/income/summary?lineUserId=${uid}&year=${yr}&month=${mo}`).then((r) => r.json()),
      fetch(`/api/income/summary?lineUserId=${uid}&year=${yr}`).then((r) => r.json()),
      fetch(`/api/expense/summary?lineUserId=${uid}&year=${yr}&month=${mo}`).then((r) => r.json()),
      fetch(`/api/expense/summary?lineUserId=${uid}&year=${yr}`).then((r) => r.json()),
      fetch(`/api/tax/summary?lineUserId=${uid}&year=${yr}`).then((r) => r.json()),
      fetch(`/api/user/status?lineUserId=${uid}`).then((r) => r.json()),
      fetch(`/api/user/links?lid=${uid}`).then((r) => r.json()),
    ]).then(([moIncome, yrIncome, moExpense, yrExpense, tax, status, lnks]) => {
      const recommended = tax.recommended ?? 1;
      const taxAmt = recommended === 1 ? (tax.method1?.estimatedTax ?? 0) : (tax.method2?.estimatedTax ?? 0);
      setStats({
        monthIncome:  moIncome.total  ?? 0,
        yearIncome:   yrIncome.total  ?? 0,
        monthExpense: moExpense.total ?? 0,
        yearExpense:  yrExpense.total ?? 0,
        estimatedTax: taxAmt,
      });
      // For admins: keep their own Google name/picture, only update businessName
      // For owners: prefer LINE display_name + picture from DB
      setUserInfo((prev) => {
        if (!prev) return null;
        if (prev.role === "admin") {
          return {
            ...prev,
            businessName: status?.profile?.businessName || prev.businessName,
          };
        }
        return {
          ...prev,
          displayName:  status?.displayName  || prev.displayName,
          pictureUrl:   status?.pictureUrl   || prev.pictureUrl,
          businessName: status?.profile?.businessName || prev.businessName,
        };
      });
      setLinks({ sheetUrl: lnks.sheet_url ?? null, driveUrl: lnks.drive_url ?? null });
    }).finally(() => setLoadingStats(false));
  }, [authReady, lineUserId, selectedYear, selectedMonth]);

  function openExternal(url: string | null, fallback: string) {
    // Always open in new tab — use URL if ready, otherwise fallback page
    window.open(url ?? fallback, "_blank", "noopener,noreferrer");
  }

  const netMonth = (stats?.monthIncome ?? 0) - (stats?.monthExpense ?? 0);
  const netYear  = (stats?.yearIncome  ?? 0) - (stats?.yearExpense  ?? 0);

  const layoutUserInfo = userInfo
    ? { displayName: userInfo.displayName, pictureUrl: userInfo.pictureUrl, businessName: userInfo.businessName }
    : null;

  return (
    <AppLayout userInfo={layoutUserInfo} title="หน้าหลัก">
      <div className="px-4 lg:px-6 py-6 max-w-5xl mx-auto space-y-6">


        {/* ── Big stat cards (year) ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-widest">ภาพรวมทั้งปี</p>
            <select
              value={selectedYear}
              onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedMonth(CURRENT_MONTH); }}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-[#0A192F] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 cursor-pointer"
            >
              {Array.from({ length: 4 }, (_, i) => CURRENT_YEAR - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* Income */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <IconIncome className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">รายรับรวม</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4 mb-1" />
              ) : (
                <p className="text-2xl font-bold text-[#0A192F]">฿{fmtInt(stats?.yearIncome ?? 0)}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Income · {selectedYear}</p>
            </div>

            {/* Expense */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <IconExpense className="w-4 h-4 text-rose-600" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">รายจ่ายรวม</span>
              </div>
              {loadingStats ? (
                <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4 mb-1" />
              ) : (
                <p className="text-2xl font-bold text-[#0A192F]">฿{fmtInt(stats?.yearExpense ?? 0)}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Expense · {selectedYear}</p>
            </div>

            {/* Net */}
            <div className={`rounded-2xl border p-5 shadow-sm ${netYear >= 0 ? "bg-[#0A192F] border-[#0A192F]" : "bg-white border-amber-100"}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${netYear >= 0 ? "bg-white/10" : "bg-amber-50"}`}>
                  <IconTax className={`w-4 h-4 ${netYear >= 0 ? "text-[#10B981]" : "text-amber-500"}`} />
                </div>
                <span className={`text-xs font-semibold uppercase tracking-wide ${netYear >= 0 ? "text-white/50" : "text-gray-400"}`}>กำไรสุทธิ</span>
              </div>
              {loadingStats ? (
                <div className={`h-8 rounded animate-pulse w-3/4 mb-1 ${netYear >= 0 ? "bg-white/10" : "bg-gray-100"}`} />
              ) : (
                <p className={`text-2xl font-bold ${netYear >= 0 ? "text-white" : "text-amber-600"}`}>
                  {netYear < 0 ? "-" : ""}฿{fmtInt(Math.abs(netYear))}
                </p>
              )}
              <p className={`text-xs mt-1 ${netYear >= 0 ? "text-white/40" : "text-amber-400"}`}>
                {netYear < 0 ? "ขาดทุน" : "Net Profit"} · {selectedYear}
              </p>
            </div>

          </div>
        </div>

        {/* ── Month stats + Tax ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Month stats */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {/* Card header with inline month dropdown */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold text-[#4A5568] uppercase tracking-widest">เดือน</p>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-[#0A192F] font-medium focus:outline-none focus:ring-2 focus:ring-[#0A192F]/20 cursor-pointer"
                >
                  {MONTH_TH.slice(1).map((label, i) => (
                    <option key={i + 1} value={i + 1}>{label} {selectedYear}</option>
                  ))}
                </select>
                {(selectedMonth !== CURRENT_MONTH || selectedYear !== CURRENT_YEAR) && (
                  <button
                    onClick={() => setSelectedMonth(CURRENT_MONTH)}
                    className="text-xs text-[#4A5568] hover:text-[#0A192F] underline underline-offset-2 transition-colors whitespace-nowrap"
                  >
                    เดือนนี้
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-0">
              {/* Pie chart — แสดงยอดรวมปี (ไม่ขึ้นกับเดือนที่เลือก) */}
              <div className="w-1/2 flex flex-col items-center justify-center gap-1">
                {loadingStats ? (
                  <div className="w-36 h-36 rounded-full bg-gray-100 animate-pulse" />
                ) : (
                  <>
                    <PieChart income={stats?.monthIncome ?? 0} expense={stats?.monthExpense ?? 0} />
                    <p className="text-[10px] text-gray-400">{MONTH_TH[selectedMonth]} {selectedYear}</p>
                  </>
                )}
              </div>
              {/* Numbers — เดือนที่เลือก */}
              <div className="w-1/2 flex flex-col justify-center gap-4 pl-4 border-l border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 mb-1">รายรับ</p>
                  {loadingStats ? <div className="h-6 bg-gray-100 rounded animate-pulse" /> : (
                    <p className="text-xl font-bold text-emerald-600">
                      {stats?.monthIncome ? `฿${fmtInt(stats.monthIncome)}` : <span className="text-gray-300">—</span>}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">รายจ่าย</p>
                  {loadingStats ? <div className="h-6 bg-gray-100 rounded animate-pulse" /> : (
                    <p className="text-xl font-bold text-rose-500">
                      {stats?.monthExpense ? `฿${fmtInt(stats.monthExpense)}` : <span className="text-gray-300">—</span>}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">กำไร</p>
                  {loadingStats ? <div className="h-6 bg-gray-100 rounded animate-pulse" /> : (
                    netMonth === 0 && !stats?.monthIncome && !stats?.monthExpense
                      ? <span className="text-gray-300 text-xl font-bold">—</span>
                      : <p className={`text-xl font-bold ${netMonth >= 0 ? "text-blue-600" : "text-amber-500"}`}>
                          {netMonth < 0 ? "-" : ""}฿{fmtInt(Math.abs(netMonth))}
                        </p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="mt-5 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <button onClick={() => openExternal(links.sheetUrl, "/sheets")}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-green-200 hover:bg-green-50 transition-colors text-left">
                <IconGoogleSheets className="w-6 h-6 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">Google Sheets</p>
                  <p className="text-[10px] text-gray-400 truncate">{links.sheetUrl ? "เปิด ↗" : "ยังไม่มี"}</p>
                </div>
              </button>
              <button onClick={() => openExternal(links.driveUrl, "/drive")}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-yellow-200 hover:bg-yellow-50 transition-colors text-left">
                <IconGoogleDrive className="w-6 h-6 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">Google Drive</p>
                  <p className="text-[10px] text-gray-400 truncate">{links.driveUrl ? "เปิด ↗" : "ยังไม่มี"}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Tax card */}
          <div className="lg:col-span-2 bg-[#0A192F] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <IconTax className="w-4 h-4 text-[#10B981]" />
                </div>
                <span className="text-white/50 text-xs font-semibold uppercase tracking-wide">ภาษีโดยประมาณ</span>
              </div>
              {loadingStats ? (
                <div className="h-10 bg-white/10 rounded animate-pulse w-2/3 mb-2" />
              ) : (
                <p className="text-3xl font-bold text-white">฿{fmt(stats?.estimatedTax ?? 0)}</p>
              )}
              {!loadingStats && (stats?.estimatedTax ?? 0) === 0 && (
                <p className="text-white/30 text-xs mt-1">ยังไม่ถึงเกณฑ์เสียภาษี</p>
              )}
              <p className="text-white/30 text-xs mt-1">ปี {selectedYear}</p>
            </div>
            <Link href="/phasi"
              className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#0ea572] transition-colors text-white text-sm font-semibold">
              ดูรายละเอียด →
            </Link>
          </div>

        </div>

        {/* ── Help button ───────────────────────────────────────────────────── */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <IconHelp className="w-4 h-4" /> วิธีใช้งาน
          </button>
        </div>

      </div>

      {showTour && <TourModal onClose={closeTour} />}
    </AppLayout>
  );
}
