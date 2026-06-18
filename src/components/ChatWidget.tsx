"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { IconSparkle, IconRocket, IconCrown, IconX } from "@/components/icons";
import { lsGet } from "@/lib/storage";

type Msg = { role: "user" | "assistant"; content: string };

// Only show the assistant on the authenticated app pages (not landing/onboarding/etc.)
const SHOW_ON = ["/home", "/rairab", "/raijhai", "/phasi", "/stock", "/settings", "/scan", "/drive", "/sheets"];

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

export default function ChatWidget() {
  const { status } = useSession();
  const pathname = usePathname();

  const [open, setOpen]     = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [plan, setPlan]     = useState<"pro" | "platinum" | null>(null);
  const [locked, setLocked] = useState(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [used, setUsed]   = useState(0);
  const [limit, setLimit] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
        if (chatRes.status === 403) { setLocked(true); }
        else if (chatRes.ok) {
          const cd = await chatRes.json();
          setPlan(cd.plan);
          setUsed(cd.used);
          setLimit(cd.limit);
          setMessages((cd.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
        }
      } catch { /* ignore */ }
      setLoaded(true);
      setLoading(false);
    })();
  }, [open, loaded, loading, status]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending || !userId) return;
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);

    // Salary/commission/deductions live only in the tax page's localStorage —
    // send them so the bot's numbers match the Tax Summary page.
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

  // Render only for logged-in users on app pages
  if (status !== "authenticated" || !SHOW_ON.some((p) => pathname.startsWith(p))) return null;

  const tips = plan ? SUGGESTIONS[plan] ?? [] : [];

  return (
    <>
      {/* Prominent floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="เปิด Vendee AI Assistant"
          className="fixed z-[60] right-4 bottom-20 lg:bottom-6 flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-xl shadow-purple-900/30 ring-2 ring-white/40 hover:scale-105 active:scale-95 transition-transform"
        >
          <span className="relative flex items-center justify-center w-7 h-7">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/40 animate-ping" />
            <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20">
              <IconSparkle className="w-4 h-4" />
            </span>
          </span>
          <span className="font-bold text-sm whitespace-nowrap">Vendee AI Assistant</span>
        </button>
      )}

      {/* Full-height side drawer + overlay */}
      {open && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div className="relative w-full sm:w-[440px] h-full bg-white shadow-2xl flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <IconSparkle className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-base leading-tight">Vendee AI Assistant</p>
                  <p className="text-[12px] text-white/75 flex items-center gap-1">
                    {plan === "platinum"
                      ? <><IconCrown className="w-3.5 h-3.5" /> Platinum · แนะนำเชิงรุก</>
                      : plan === "pro" ? "Pro · สรุป & อธิบายข้อมูล" : "ผู้ช่วยการเงินอัจฉริยะ"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {limit > 0 && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${used >= limit ? "bg-rose-500/40" : "bg-white/15"}`}>
                    {used}/{limit}
                  </span>
                )}
                <button onClick={() => setOpen(false)} aria-label="ปิด" className="w-9 h-9 rounded-lg hover:bg-white/15 flex items-center justify-center">
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {locked ? (
              /* Upsell */
              <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-violet-100 text-violet-600 mb-5">
                  <IconSparkle className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">ผู้ช่วย AI สำหรับ Pro &amp; Platinum</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-7">
                  ถาม-ตอบเกี่ยวกับข้อมูลการเงินของคุณได้ทุกหน้า — <strong>Pro</strong> สรุป/อธิบายตัวเลข,
                  <strong> Platinum</strong> แนะนำเชิงรุกว่าควรทำอะไรต่อ
                </p>
                <Link href="/settings?upgrade=pro" onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white font-bold text-sm hover:opacity-90">
                  <IconRocket className="w-4 h-4" /> อัปเกรดเพื่อใช้งาน
                </Link>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-3 bg-[#F8FAFC]">
                  {loading ? (
                    <p className="text-center text-gray-400 text-sm mt-8">กำลังโหลด...</p>
                  ) : messages.length === 0 ? (
                    <div className="text-center mt-10">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 mb-3">
                        <IconSparkle className="w-7 h-7" />
                      </div>
                      <p className="text-gray-600 text-sm font-semibold mb-1">สวัสดีค่ะ 👋</p>
                      <p className="text-gray-400 text-sm mb-5">ถามอะไรก็ได้เกี่ยวกับการเงินของร้านคุณ</p>
                      <div className="flex flex-wrap justify-center gap-2 px-4">
                        {tips.map((t) => (
                          <button key={t} onClick={() => send(t)}
                            className="text-xs text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-full px-3 py-1.5 transition-colors">
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
                  {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
                  <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                      placeholder={limit > 0 && used >= limit ? "ใช้ครบโควต้าเดือนนี้แล้ว" : "พิมพ์คำถาม..."}
                      disabled={sending || (limit > 0 && used >= limit) || loading}
                      rows={1}
                      className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
                    />
                    <button
                      type="submit"
                      disabled={sending || !input.trim() || (limit > 0 && used >= limit)}
                      className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
                      aria-label="ส่ง"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </form>
                  <p className="text-[10px] text-gray-300 text-center mt-2">AI อาจคลาดเคลื่อน · ตรวจสอบตัวเลขสำคัญอีกครั้ง</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
