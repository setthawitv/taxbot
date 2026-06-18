"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import AppLayout from "@/components/AppLayout";
import { IconSparkle, IconRocket, IconCrown } from "@/components/icons";
import { lsGet } from "@/lib/storage";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: Record<string, string[]> = {
  pro: [
    "สรุปรายรับรายจ่ายเดือนนี้ให้หน่อย",
    "ปีนี้ฉันจ่ายร้านไหนเยอะที่สุด",
    "กำไรทั้งปีตอนนี้เท่าไหร่",
  ],
  platinum: [
    "ควรวางแผนภาษีปีนี้ยังไงดี",
    "ฉันควรกันเงินเดือนละเท่าไหร่",
    "มีรายจ่ายตรงไหนที่ควรลด",
    "คาดการณ์ภาษีสิ้นปีให้หน่อย",
  ],
};

export default function ChatPage() {
  const { data: session, status } = useSession();
  const [userId, setUserId]   = useState<string | null>(null);
  const [plan, setPlan]       = useState<"pro" | "platinum" | null>(null);
  const [locked, setLocked]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [used, setUsed]   = useState(0);
  const [limit, setLimit] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, sending]);

  // Resolve the user + load history
  useEffect(() => {
    if (status === "loading") return;
    async function load() {
      try {
        const res = await fetch("/api/user/by-email");
        if (!res.ok) { setLoading(false); return; }
        const d = await res.json();
        if (!d.userId) { setLoading(false); return; }
        setUserId(d.userId);

        const chatRes = await fetch(`/api/chat?userId=${d.userId}`);
        if (chatRes.status === 403) { setLocked(true); setLoading(false); return; }
        if (chatRes.ok) {
          const cd = await chatRes.json();
          setPlan(cd.plan);
          setUsed(cd.used);
          setLimit(cd.limit);
          setMessages((cd.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })));
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [status, session]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || sending || !userId) return;
    setError("");
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setSending(true);

    // Salary / commission / deductions live only in the tax page's localStorage —
    // send them so the bot's income & tax match the Tax Summary page.
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

  // ── Locked (not Pro/Platinum) ───────────────────────────────────────────────
  if (locked) {
    return (
      <AppLayout title="ผู้ช่วย AI">
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 text-violet-600 mb-4">
            <IconSparkle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">ผู้ช่วย AI สำหรับ Pro &amp; Platinum</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            ถาม-ตอบเกี่ยวกับข้อมูลการเงินของคุณได้เลย — <strong>Pro</strong> สรุป/อธิบายตัวเลข,
            <strong> Platinum</strong> แนะนำเชิงรุกว่าควรทำอะไรต่อ
          </p>
          <Link href="/settings?upgrade=pro"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm hover:opacity-90 transition-opacity">
            <IconRocket className="w-4 h-4" /> อัปเกรดเพื่อใช้งาน
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tips = plan ? SUGGESTIONS[plan] ?? [] : [];

  return (
    <AppLayout title="ผู้ช่วย AI">
      <div className="flex flex-col h-[calc(100vh-3.5rem)] lg:h-screen max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white">
              <IconSparkle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">ผู้ช่วย AI</p>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                {plan === "platinum"
                  ? <><IconCrown className="w-3 h-3 text-amber-500" /> Platinum · แนะนำเชิงรุก</>
                  : "Pro · สรุป &amp; อธิบายข้อมูล"}
              </p>
            </div>
          </div>
          {limit > 0 && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${used >= limit ? "bg-rose-100 text-rose-600" : "bg-gray-100 text-gray-500"}`}>
              {used} / {limit}
            </span>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-[#F8FAFC]">
          {loading ? (
            <p className="text-center text-gray-400 text-sm mt-8">กำลังโหลด...</p>
          ) : messages.length === 0 ? (
            <div className="text-center mt-10">
              <p className="text-gray-500 text-sm mb-4">เริ่มถามอะไรก็ได้เกี่ยวกับข้อมูลการเงินของคุณ</p>
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
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
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
        <div className="border-t border-gray-100 bg-white px-4 py-3">
          {error && <p className="text-xs text-rose-500 mb-2 text-center">{error}</p>}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              placeholder={used >= limit && limit > 0 ? "ใช้ครบโควต้าเดือนนี้แล้ว" : "พิมพ์คำถาม..."}
              disabled={sending || (limit > 0 && used >= limit)}
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-400 max-h-32"
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || (limit > 0 && used >= limit)}
              className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
              aria-label="ส่ง"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
          <p className="text-[10px] text-gray-300 text-center mt-2">
            AI อาจคลาดเคลื่อน · ตรวจสอบตัวเลขสำคัญอีกครั้ง
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
