"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconSparkle, IconCrown, IconX } from "@/components/icons";
import { useChat } from "@/components/ChatContext";
import { lsGet } from "@/lib/storage";

type Msg = { role: "user" | "assistant"; content: string };

const NAVY = "#0A192F";

// Only show the assistant on the authenticated app pages (not landing/onboarding/etc.)
const SHOW_ON = ["/home", "/rairab", "/raijhai", "/phasi", "/stock", "/settings", "/scan", "/drive", "/sheets", "/shopee-fee"];

const SUGGESTIONS: Record<string, string[]> = {
  pro: [
    "สรุปรายรับรายจ่ายเดือนนี้",
    "ปีนี้จ่ายร้านไหนเยอะสุด",
    "กำไรทั้งปีตอนนี้เท่าไหร่",
  ],
  platinum: [
    "ควรวางแผนภาษีปีนี้ยังไง",
    "ควรกันเงินเดือนละเท่าไหร่",
    "มีรายจ่ายตรงไหนที่ควรลด",
  ],
};

// ── Instant quick answers (no AI call, no quota) ──────────────────────────────
type TaxSummary = {
  totalIncome?:  number;
  totalExpense?: number;
  byPlatform?:   Record<string, number>;
};
type Summary = { tax: TaxSummary | null; monthIncome: number; monthExpense: number };

const QUICK: { q: string; key: string }[] = [
  { q: "เดือนนี้กำไรเท่าไหร่?",            key: "monthProfit" },
  { q: "ปีนี้รายรับ/รายจ่ายรวมเท่าไหร่?", key: "yearTotals" },
  { q: "แพลตฟอร์มไหนขายดีสุดปีนี้?",      key: "topPlatform" },
  { q: "ภาษีปีนี้ประมาณเท่าไหร่?",        key: "tax" },
  { q: "รายได้ถึงเกณฑ์ VAT หรือยัง?",     key: "vat" },
  { q: "หักค่าใช้จ่ายแบบไหนคุ้มกว่า?",    key: "method" },
  { q: "โควต้าถาม AI เหลือกี่ครั้ง?",     key: "aiQuota" },
  { q: "ภาษีต้องยื่นเมื่อไหร่?",          key: "taxDeadline" },
  { q: "ลดหย่อนภาษีมีอะไรบ้าง?",         key: "deductions" },
  { q: "นำเข้า Excel ยังไง?",            key: "howImport" },
  { q: "สแกนสลิปยังไง?",                 key: "howScan" },
];

const PLATFORM_LABEL: Record<string, string> = { tiktok: "TikTok", shopee: "Shopee", lazada: "Lazada" };
const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");

const QUICK_BRACKETS = [
  { max: 150_000, rate: 0 }, { max: 300_000, rate: 0.05 }, { max: 500_000, rate: 0.10 },
  { max: 750_000, rate: 0.15 }, { max: 1_000_000, rate: 0.20 }, { max: 2_000_000, rate: 0.25 },
  { max: 5_000_000, rate: 0.30 }, { max: Infinity, rate: 0.35 },
];
function bracketTax(taxable: number): number {
  let r = Math.max(0, taxable), tax = 0, prev = 0;
  for (const b of QUICK_BRACKETS) { if (r <= 0) break; const s = Math.min(r, b.max - prev); tax += s * b.rate; r -= s; prev = b.max; }
  return Math.round(tax);
}

export default function ChatWidget() {
  const { status } = useSession();
  const pathname = usePathname();
  const { open, setOpen, setWidth, setDragging } = useChat();

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan]     = useState<string | null>(null);
  const [label, setLabel]   = useState("");
  const [period, setPeriod] = useState<"week" | "month">("month");
  const [mode, setMode]     = useState<"descriptive" | "predictive">("descriptive");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [used, setUsed]   = useState(0);
  const [limit, setLimit] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showQuick, setShowQuick] = useState(false);

  const shouldShow = status === "authenticated" && SHOW_ON.some((p) => pathname.startsWith(p));

  useEffect(() => { if (!shouldShow && open) setOpen(false); }, [shouldShow, open, setOpen]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  // Lazy-load history the first time the panel is opened (GET is DB-only, no AI)
  useEffect(() => {
    if (!open || loaded || loading || status !== "authenticated") return;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/user/by-email");
        if (!res.ok) { setLoaded(true); setLoading(false); return; }
        const d = await res.json();
        if (!d.userId) { setLoaded(true); setLoading(false); return; }
        setUserId(d.userId);

        const chatRes = await fetch(`/api/chat?userId=${d.userId}`);
        if (chatRes.ok) {
          const cd = await chatRes.json();
          setPlan(cd.plan);
          setLabel(cd.label ?? "");
          setPeriod(cd.period ?? "month");
          setMode(cd.mode ?? "descriptive");
          setUsed(cd.used);
          setLimit(cd.limit);
          setMessages((cd.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
        }

        // Financial summary for the instant quick-answer chips (no AI involved)
        const yr = new Date().getFullYear();
        const mo = new Date().getMonth() + 1;
        const [taxR, incMo, expMo] = await Promise.all([
          fetch(`/api/tax/summary?userId=${d.userId}&year=${yr}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/income/summary?userId=${d.userId}&year=${yr}&month=${mo}`).then((r) => r.json()).catch(() => null),
          fetch(`/api/expense/summary?userId=${d.userId}&year=${yr}&month=${mo}`).then((r) => r.json()).catch(() => null),
        ]);
        setSummary({ tax: taxR, monthIncome: incMo?.total ?? 0, monthExpense: expMo?.total ?? 0 });
      } catch { /* ignore */ }
      setLoaded(true);
      setLoading(false);
    })();
  }, [open, loaded, loading, status]);

  // Drag the left edge to resize the panel (and the page-shift padding with it)
  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    setDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: PointerEvent) => setWidth(window.innerWidth - ev.clientX);
    const onUp = () => {
      setDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending || !userId) return;
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);

    const yr = new Date().getFullYear();
    let deductions: Record<string, number> = {};
    try { deductions = JSON.parse(lsGet(`deductions_${yr}`) || "{}"); } catch { /* ignore */ }
    const clientData = {
      salary:     parseFloat(lsGet(`salary_${yr}`) || "0") || 0,
      commission: parseFloat(lsGet(`commission_${yr}`) || "0") || 0,
      deductions,
    };

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId, message: msg, clientData }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "เกิดข้อผิดพลาด");
        if (d.quotaExceeded) { setUsed(d.used); setLimit(d.limit); }
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: d.reply }]);
      setUsed(d.used);
      setLimit(d.limit);
    } catch {
      setError("เครือข่ายขัดข้อง ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  }

  // Compute tax both ways (เหมา 60% vs ตามจริง) including salary from localStorage
  function taxBoth() {
    const inc = summary?.tax?.totalIncome  ?? 0;
    const exp = summary?.tax?.totalExpense ?? 0;
    const yr  = new Date().getFullYear();
    let extra = 0;
    try {
      const ded = JSON.parse(lsGet(`deductions_${yr}`) || "{}");
      extra = Object.entries(ded as Record<string, number>)
        .filter(([k]) => k !== "personal")
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    } catch { /* ignore */ }
    const salaryComm = (parseFloat(lsGet(`salary_${yr}`) || "0") || 0) + (parseFloat(lsGet(`commission_${yr}`) || "0") || 0);
    const salaryNet  = salaryComm - Math.min(salaryComm * 0.5, 100_000);
    const allow      = 60_000 + extra;
    const t1 = bracketTax(inc * 0.4 + salaryNet - allow);   // หักเหมา 60%
    const t2 = bracketTax((inc - exp) + salaryNet - allow); // หักตามจริง
    return { inc, t1, t2, salaryComm };
  }

  // Instant, deterministic answers — no /api/chat call, no quota used
  function quickAnswer(key: string): string {
    const needsData = ["monthProfit", "yearTotals", "topPlatform", "tax", "vat", "method"];
    if (needsData.includes(key) && !summary) return "กำลังโหลดข้อมูล... ลองอีกครั้งค่ะ";
    const tax = summary?.tax ?? null;
    switch (key) {
      case "monthProfit": {
        const mi = summary?.monthIncome ?? 0, me = summary?.monthExpense ?? 0, p = mi - me;
        return `เดือนนี้:\n• รายรับ ฿${fmtNum(mi)}\n• รายจ่าย ฿${fmtNum(me)}\n• ${p >= 0 ? "กำไร" : "ขาดทุน"} ฿${fmtNum(Math.abs(p))}`;
      }
      case "yearTotals": {
        const inc = tax?.totalIncome ?? 0, exp = tax?.totalExpense ?? 0, p = inc - exp;
        return `ปีนี้ทั้งหมด:\n• รายรับรวม ฿${fmtNum(inc)}\n• รายจ่ายรวม ฿${fmtNum(exp)}\n• ${p >= 0 ? "กำไร" : "ขาดทุน"}สุทธิ ฿${fmtNum(Math.abs(p))}`;
      }
      case "topPlatform": {
        const sorted = Object.entries(tax?.byPlatform ?? {}).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return "ปีนี้ยังไม่มียอดขายจากแพลตฟอร์มค่ะ";
        const name = (k: string) => PLATFORM_LABEL[k] ?? k;
        let s = `แพลตฟอร์มที่ขายดีสุดปีนี้: ${name(sorted[0][0])} ฿${fmtNum(sorted[0][1])}`;
        if (sorted.length > 1) s += `\nรองลงมา: ${sorted.slice(1).map(([p, a]) => `${name(p)} ฿${fmtNum(a)}`).join(", ")}`;
        return s;
      }
      case "tax": {
        const { t1, t2, salaryComm } = taxBoth();
        const t = Math.min(t1, t2);
        let s = `ภาษีเงินได้ปีนี้โดยประมาณ ≈ ฿${fmtNum(t)}`;
        if (salaryComm > 0) s += `\n(รวมเงินเดือน/คอม ฿${fmtNum(salaryComm)} จากหน้าภาษี)`;
        s += `\nเลือกวิธีถูกกว่าให้แล้ว — เหมา 60%: ฿${fmtNum(t1)} / ตามจริง: ฿${fmtNum(t2)}`;
        if (t === 0) s += `\nตอนนี้ยังไม่ถึงเกณฑ์ต้องเสียภาษีค่ะ`;
        return s;
      }
      case "vat": {
        const inc = tax?.totalIncome ?? 0;
        if (inc >= 1_800_000) return `รายได้ธุรกิจปีนี้ ฿${fmtNum(inc)}\n⚠️ ถึงเกณฑ์แล้ว — ต้องจดทะเบียน VAT (เกิน 1.8 ล้าน)`;
        return `รายได้ธุรกิจปีนี้ ฿${fmtNum(inc)}\nยังไม่ถึงเกณฑ์ VAT — เหลืออีก ฿${fmtNum(1_800_000 - inc)} จะถึง 1.8 ล้าน`;
      }
      case "method": {
        const { t1, t2 } = taxBoth();
        const better = t1 <= t2 ? "หักเหมา 60%" : "หักตามจริง";
        const save = Math.abs(t1 - t2);
        return `เปรียบเทียบวิธีหักค่าใช้จ่าย (ภาษีปีนี้):\n• หักเหมา 60% → ฿${fmtNum(t1)}\n• หักตามจริง → ฿${fmtNum(t2)}\n👉 แนะนำ "${better}"${save > 0 ? ` ประหยัดกว่า ฿${fmtNum(save)}` : " (เท่ากัน)"}`;
      }
      case "aiQuota": {
        const left = Math.max(0, limit - used);
        const u = period === "week" ? "สัปดาห์" : "เดือน";
        return limit > 0
          ? `โควต้าถาม AI (พิมพ์เอง): เหลืออีก ${left} จาก ${limit} ครั้ง/${u}\n(ปุ่มคำถามด่วนแบบนี้ไม่นับโควต้านะคะ — กดได้เรื่อยๆ)`
          : `กำลังโหลดข้อมูลโควต้าค่ะ`;
      }
      case "taxDeadline":
        return `กำหนดยื่นภาษีเงินได้บุคคลธรรมดา (ภ.ง.ด.90/91):\n• ยื่นกระดาษ: ภายใน 31 มีนาคม ปีถัดไป\n• ยื่นออนไลน์ (e-Filing): ขยายถึงประมาณ 8 เมษายน\nยื่นที่กรมสรรพากร (rd.go.th)`;
      case "deductions":
        return `ค่าลดหย่อนยอดนิยม:\n• ส่วนตัว 60,000\n• คู่สมรส 60,000\n• บุตร 30,000/คน\n• ประกันสังคม (ตามจ่ายจริง ≤ 9,000)\n• ประกันชีวิต ≤ 100,000\n• กองทุน SSF/RMF, ดอกเบี้ยบ้าน, บริจาค ฯลฯ\nกรอกได้ในหน้า "ภาษี" เพื่อคำนวณแม่นขึ้น`;
      case "howImport":
        return `นำเข้ายอดขายจากแพลตฟอร์ม:\n1. โหลดไฟล์ Excel ออเดอร์จาก Shopee / TikTok / Lazada\n2. ไปหน้า "รายรับ" → ปุ่มนำเข้า\n3. อัปโหลดไฟล์ — ระบบแยกยอดให้อัตโนมัติ\n(จำนวนไฟล์/เดือนตามแพ็กเกจ)`;
      case "howScan":
        return `สแกนสลิป/ใบเสร็จ:\n1. ไปหน้า "รายจ่าย" หรือปุ่มสแกน\n2. ถ่ายรูป/อัปโหลดสลิป\n3. AI อ่านยอด-วันที่-ร้านค้าให้ ตรวจแล้วกดบันทึก\n(โควต้าสแกนตามแพ็กเกจ)`;
      default: return "ขออภัย ไม่พบคำตอบค่ะ";
    }
  }

  function onQuick(item: { q: string; key: string }) {
    setShowQuick(false);
    setMessages((m) => [...m, { role: "user", content: item.q }, { role: "assistant", content: quickAnswer(item.key) }]);
  }

  if (!shouldShow) return null;

  const tips = mode === "predictive" ? SUGGESTIONS.platinum : SUGGESTIONS.pro;
  const unit = period === "week" ? "สัปดาห์" : "เดือน";
  const atLimit = limit > 0 && used >= limit;

  return (
    <>
      {/* Prominent floating launcher (fades out while the panel is open) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="เปิด Vendee AI Assistant"
        style={{ backgroundColor: NAVY }}
        className={`fixed z-[55] right-4 bottom-20 lg:bottom-6 flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full text-white shadow-xl shadow-black/30 ring-2 ring-white/25 hover:scale-105 active:scale-95 transition-all ${open ? "opacity-0 pointer-events-none translate-y-2" : "opacity-100"}`}
      >
        <span className="relative flex items-center justify-center w-7 h-7">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400/50 animate-ping" />
          <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-emerald-300">
            <IconSparkle className="w-4 h-4" />
          </span>
        </span>
        <span className="font-bold text-sm whitespace-nowrap">Vendee AI Assistant</span>
      </button>

      {/* Side panel — slides in from the right; no backdrop, page stays usable */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-[60] w-full lg:w-[var(--chat-w,440px)] bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        {/* Resize handle (desktop) */}
        <div
          onPointerDown={startDrag}
          className="hidden lg:block absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-col-resize group z-10"
          aria-label="ลากเพื่อปรับความกว้าง"
        >
          <span className="absolute inset-y-0 left-1 w-0.5 bg-transparent group-hover:bg-emerald-400 group-active:bg-emerald-500 transition-colors" />
        </div>

        {/* Header */}
        <div style={{ backgroundColor: NAVY }} className="flex items-center justify-between px-5 py-4 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-emerald-300">
              <IconSparkle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-base leading-tight">Vendee AI Assistant</p>
              <p className="text-[12px] text-white/60 flex items-center gap-1">
                {plan === "platinum" && <IconCrown className="w-3.5 h-3.5 text-amber-400" />}
                {label || "Vendee"}{limit > 0 ? ` · ${limit} ครั้ง/${unit}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {limit > 0 && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${used >= limit ? "bg-rose-500/40" : "bg-white/10"}`}>
                {used}/{limit}
              </span>
            )}
            <button onClick={() => setOpen(false)} aria-label="ปิด" className="w-9 h-9 rounded-lg hover:bg-white/10 flex items-center justify-center">
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-[#F8FAFC]">
              {loading ? (
                <p className="text-center text-gray-400 text-sm mt-8">กำลังโหลด...</p>
              ) : messages.length === 0 ? (
                <div className="text-center mt-10">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
                    <IconSparkle className="w-7 h-7" />
                  </div>
                  <p className="text-gray-600 text-sm font-semibold mb-1">สวัสดีค่ะ 👋</p>
                  <p className="text-gray-400 text-sm mb-5">ถามอะไรก็ได้เกี่ยวกับการเงินของร้านคุณ</p>
                  <div className="flex flex-wrap justify-center gap-2 px-4">
                    {tips.map((t) => (
                      <button key={t} onClick={() => send(t)}
                        className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-full px-3 py-1.5 transition-colors">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === "user"
                        ? "bg-emerald-500 text-white rounded-br-sm"
                        : "bg-white text-gray-700 border border-gray-100 rounded-bl-sm shadow-sm"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 bg-white px-3 py-3 flex-shrink-0">
              {/* Instant quick answers — free, no quota (collapsible, wraps) */}
              <button type="button" onClick={() => setShowQuick((v) => !v)}
                className="flex items-center justify-between w-full text-xs font-semibold text-[#0A192F] bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2 mb-2 border border-slate-200 transition-colors">
                <span>⚡ คำถามด่วน · ฟรี ไม่นับโควต้า</span>
                <span className="text-slate-400">{showQuick ? "▲" : "▼"}</span>
              </button>
              {showQuick && (
                <div className="flex flex-wrap gap-2 mb-2 max-h-44 overflow-y-auto">
                  {QUICK.map((item) => (
                    <button key={item.key} type="button" onClick={() => onQuick(item)}
                      className="text-xs font-medium text-[#0A192F] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full px-3 py-1.5 transition-colors">
                      {item.q}
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
              {atLimit && plan !== "platinum" && (
                <Link href="/settings?upgrade=pro" onClick={() => setOpen(false)}
                  className="block text-center text-xs font-semibold text-emerald-600 mb-2 hover:underline">
                  ⬆️ อัปเกรดเพื่อถามได้มากขึ้น
                </Link>
              )}
              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                  placeholder={limit > 0 && used >= limit ? "ใช้ครบโควต้าเดือนนี้แล้ว" : "พิมพ์คำถาม..."}
                  disabled={sending || (limit > 0 && used >= limit) || loading}
                  rows={1}
                  className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-400 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim() || (limit > 0 && used >= limit)}
                  style={{ backgroundColor: NAVY }}
                  className="flex-shrink-0 w-10 h-10 rounded-2xl text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity"
                  aria-label="ส่ง"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                พิมพ์ถาม = ใช้โควต้า AI · ปุ่มคำถามด่วน = ฟรี · AI อาจคลาดเคลื่อน
              </p>
            </div>
        </>
      </div>
    </>
  );
}
