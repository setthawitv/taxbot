"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  IconHome, IconHelp, IconSettings,
  IconIncome, IconExpense, IconTax,
  IconGoogleSheets, IconGoogleDrive,
  IconScan, IconShield, IconCheckCircle, IconWave, IconLightbulb, IconUser, IconRocket,
} from "@/components/icons";
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
    title: "ยินดีต้อนรับสู่ TaxBot",
    desc:  "TaxBot ช่วยให้คุณจัดการรายรับ-รายจ่าย และคำนวณภาษีได้ง่าย โดยไม่ต้องมีความรู้บัญชี มาดูแต่ละฟีเจอร์กันเลย",
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

export default function Home() {
  const [lineUserId,   setLineUserId]   = useState("");
  const [authReady,    setAuthReady]    = useState(false);
  const [userInfo,     setUserInfo]     = useState<UserInfo | null>(null);
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [links,        setLinks]        = useState<Links>({ sheetUrl: null, driveUrl: null });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showTour,     setShowTour]     = useState(false);

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
    const yr  = CURRENT_YEAR;
    const mo  = CURRENT_MONTH;

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
  }, [authReady, lineUserId]);

  function openExternal(url: string | null, fallback: string) {
    // Always open in new tab — use URL if ready, otherwise fallback page
    window.open(url ?? fallback, "_blank", "noopener,noreferrer");
  }

  const netMonth = (stats?.monthIncome ?? 0) - (stats?.monthExpense ?? 0);
  const netYear  = (stats?.yearIncome  ?? 0) - (stats?.yearExpense  ?? 0);

  return (
    <main className="min-h-screen bg-brand-neutral">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-8">
          {userInfo?.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userInfo.pictureUrl} alt="profile"
              className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow"><IconUser className="w-7 h-7" /></div>
          )}
          <div className="flex-1 min-w-0">
            {userInfo?.role === "admin" ? (
              <>
                <h1 className="text-xl font-bold text-brand-primary truncate">
                  {userInfo.displayName}
                </h1>
                <p className="text-gray-400 text-sm truncate">
                  {userInfo.businessName
                    ? <>{userInfo.businessName}</>
                    : "Admin · Dashboard"}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-brand-primary truncate">
                  {userInfo?.businessName || userInfo?.displayName || "TaxBot"}
                </h1>
                <p className="text-gray-400 text-sm truncate">
                  {userInfo?.businessName ? userInfo.displayName || "Dashboard" : "Dashboard · ปี " + CURRENT_YEAR}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/landing"
              title="หน้าแรก"
              className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-800 hover:bg-gray-50 bg-white border border-gray-200 rounded-xl transition-colors">
              <IconHome />
            </Link>
            <button
              onClick={() => setShowTour(true)}
              title="วิธีใช้งาน"
              className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-gray-800 hover:bg-gray-50 bg-white border border-gray-200 rounded-xl transition-colors"
            >
              <IconHelp />
            </button>
            <Link href="/settings"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 bg-white border border-gray-200 px-3.5 h-10 rounded-xl transition-colors">
              <IconSettings className="w-4 h-4" /> <span className="font-medium">ตั้งค่า</span>
            </Link>
          </div>
        </div>

        {/* ── Main grid (desktop: 3 cols, mobile: 1 col) ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Navigation + Tools ──────────────────────────────────────── */}
          <div className="space-y-3 lg:order-first">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">เมนูหลัก</p>

            <Link href="/rairab"
              className="flex items-center gap-4 p-4 rounded-2xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <IconIncome />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-emerald-700">รายรับ</div>
                <div className="text-gray-400 text-xs">Income · นำเข้าไฟล์แพลตฟอร์ม</div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </Link>

            <Link href="/raijhai"
              className="flex items-center gap-4 p-4 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <IconExpense />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-rose-700">รายจ่าย</div>
                <div className="text-gray-400 text-xs">Expense · บันทึกค่าใช้จ่าย</div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </Link>

            <Link href="/phasi"
              className="flex items-center gap-4 p-4 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <IconTax />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-blue-700">ภาษี</div>
                <div className="text-gray-400 text-xs">Tax · สรุปภาษีรายปี</div>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </Link>

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">Google Tools</p>

            <button onClick={() => openExternal(links.sheetUrl, "/sheets")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-green-50 hover:border-green-200 transition-colors text-left">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-100">
                <IconGoogleSheets className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">Google Sheets</div>
                <div className="text-gray-400 text-xs">
                  {loadingStats ? "กำลังโหลด..." : links.sheetUrl ? "เปิดในแท็บใหม่ ↗" : "ยังไม่มี Sheet"}
                </div>
              </div>
            </button>

            <button onClick={() => openExternal(links.driveUrl, "/drive")}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-yellow-50 hover:border-yellow-200 transition-colors text-left">
              <div className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-gray-100">
                <IconGoogleDrive className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-800">Google Drive</div>
                <div className="text-gray-400 text-xs">
                  {loadingStats ? "กำลังโหลด..." : links.driveUrl ? "เปิดในแท็บใหม่ ↗" : "ยังไม่มีโฟลเดอร์"}
                </div>
              </div>
            </button>
          </div>

          {/* RIGHT: Stats + Tax ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Month stats row */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                {MONTH_TH[CURRENT_MONTH]} {CURRENT_YEAR}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="รายรับเดือนนี้"  value={`฿${fmtInt(stats?.monthIncome  ?? 0)}`} color="emerald" loading={loadingStats} />
                <StatCard label="รายจ่ายเดือนนี้" value={`฿${fmtInt(stats?.monthExpense ?? 0)}`} color="rose"    loading={loadingStats} />
                <StatCard
                  label="กำไรสุทธิเดือนนี้"
                  value={`${netMonth < 0 ? "-" : ""}฿${fmtInt(Math.abs(netMonth))}`}
                  sub={netMonth < 0 ? "ขาดทุน" : undefined}
                  color={netMonth >= 0 ? "blue" : "amber"}
                  loading={loadingStats}
                />
              </div>
            </div>

            {/* Year stats row */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                ทั้งปี {CURRENT_YEAR}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="รายรับรวมปีนี้"  value={`฿${fmtInt(stats?.yearIncome  ?? 0)}`} color="emerald" loading={loadingStats} />
                <StatCard label="รายจ่ายรวมปีนี้" value={`฿${fmtInt(stats?.yearExpense ?? 0)}`} color="rose"    loading={loadingStats} />
                <StatCard
                  label="กำไรสุทธิปีนี้"
                  value={`${netYear < 0 ? "-" : ""}฿${fmtInt(Math.abs(netYear))}`}
                  sub={netYear < 0 ? "ขาดทุน" : undefined}
                  color={netYear >= 0 ? "blue" : "amber"}
                  loading={loadingStats}
                />
              </div>
            </div>

            {/* Tax banner */}
            <div className="bg-blue-600 text-white rounded-2xl p-5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-blue-100 text-sm mb-1">ภาษีโดยประมาณ ปี {CURRENT_YEAR}</p>
                  {loadingStats ? (
                    <div className="h-8 bg-blue-500 rounded animate-pulse w-40" />
                  ) : (
                    <p className="text-3xl font-bold">฿{fmt(stats?.estimatedTax ?? 0)}</p>
                  )}
                  {!loadingStats && (stats?.estimatedTax ?? 0) === 0 && (
                    <p className="text-blue-200 text-xs mt-1">ยังไม่ถึงเกณฑ์เสียภาษี</p>
                  )}
                </div>
                <Link href="/phasi"
                  className="bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-semibold px-4 py-2.5 rounded-xl whitespace-nowrap">
                  ดูรายละเอียด →
                </Link>
              </div>
            </div>

          </div>

        </div>
      </div>

      {showTour && <TourModal onClose={closeTour} />}
    </main>
  );
}
