"use client";

import Link from "next/link";

const FEATURES = [
  {
    emoji: "📸",
    title: "สแกนใบเสร็จด้วย AI",
    desc: "ถ่ายรูปสลิปหรืออัปโหลดใบเสร็จ AI อ่านยอด วันที่ ร้านค้า และบันทึกให้อัตโนมัติ",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
    badge: "bg-purple-500/20 text-purple-300",
  },
  {
    emoji: "💰",
    title: "ติดตามรายรับ-รายจ่าย",
    desc: "ดูยอดเดือนนี้ ทั้งปี กำไร-ขาดทุน พร้อมแยกแพลตฟอร์ม TikTok / Shopee / Lazada",
    color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
  {
    emoji: "📊",
    title: "คำนวณภาษีอัตโนมัติ",
    desc: "ประมาณภาษีเงินได้บุคคลธรรมดา ตามอัตราของไทย พร้อมแนะนำวิธีหักค่าใช้จ่าย",
    color: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300",
  },
  {
    emoji: "📋",
    title: "ซิงค์ Google Sheets",
    desc: "ทุกรายการบันทึกลง Google Sheets ของคุณอัตโนมัติ ดาวน์โหลดหรือแชร์กับนักบัญชีได้ทันที",
    color: "from-green-500/20 to-green-600/10 border-green-500/30",
    badge: "bg-green-500/20 text-green-300",
  },
  {
    emoji: "📤",
    title: "นำเข้ายอดแพลตฟอร์ม",
    desc: "อัปโหลดไฟล์ Excel จาก TikTok Shop, Shopee, Lazada — ระบบแยกยอดให้อัตโนมัติ",
    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-300",
  },
  {
    emoji: "🛡️",
    title: "แชร์ให้ทีมงาน",
    desc: "เพิ่ม Admin ด้วย Google Email หรือสร้างลิงก์ Staff ให้พนักงานบันทึกรายจ่ายแทนได้",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
    badge: "bg-rose-500/20 text-rose-300",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "ฟรี",
    period: "",
    badge: null,
    color: "border-white/10 bg-white/5",
    btnClass: "bg-white/10 hover:bg-white/20 text-white",
    features: [
      "ทดลองใช้ฟรี 7 วัน (ทุกฟีเจอร์)",
      "รายจ่าย 10 รายการ/เดือน",
      "รายรับ Manual เท่านั้น",
      "ไม่รองรับ Excel import",
      "Google Sheets sync",
    ],
    disabled: [2, 3] as number[],
  },
  {
    name: "Eco",
    price: "฿100",
    period: "/เดือน",
    badge: null,
    color: "border-blue-500/40 bg-blue-500/5",
    btnClass: "bg-blue-500 hover:bg-blue-400 text-white",
    features: [
      "รายจ่าย 30 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 1 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] as number[],
  },
  {
    name: "Pro",
    price: "฿200",
    period: "/เดือน",
    badge: "🔥 แนะนำ",
    color: "border-emerald-500/60 bg-emerald-500/10 ring-2 ring-emerald-500/30",
    btnClass: "bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/25",
    features: [
      "รายจ่าย 100 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 5 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] as number[],
  },
  {
    name: "Platinum",
    price: "฿700",
    period: "/เดือน",
    badge: "👑 ครบทุกอย่าง",
    color: "border-amber-500/40 bg-amber-500/5",
    btnClass: "bg-amber-500 hover:bg-amber-400 text-white",
    features: [
      "รายจ่าย 1,200 รายการ/เดือน",
      "รายรับ Manual ไม่จำกัด",
      "นำเข้า Excel 12 ไฟล์/เดือน",
      "Google Sheets sync",
      "สแกนใบเสร็จด้วย AI",
    ],
    disabled: [] as number[],
  },
];

const STEPS = [
  { no: "01", title: "เชื่อมต่อ LINE", desc: "ล็อกอินผ่าน LINE — ไม่ต้องสมัครสมาชิก ไม่ต้องจำรหัสผ่านใหม่" },
  { no: "02", title: "เชื่อม Google Drive", desc: "เชื่อมต่อ Google เพื่อเก็บข้อมูลและซิงค์ Sheets อัตโนมัติ" },
  { no: "03", title: "เริ่มบันทึกได้เลย", desc: "สแกนใบเสร็จ บันทึกรายรับ-รายจ่าย ดูรายงาน — ทำได้ทันที" },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <span className="font-bold text-lg tracking-tight">TaxBot</span>
        </div>
        <Link
          href="/onboarding"
          className="text-sm font-semibold text-gray-300 hover:text-white transition-colors"
        >
          เข้าสู่ระบบ →
        </Link>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-16 pb-20 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
          ✨ สำหรับร้านค้าออนไลน์และ SME ไทย
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
          บัญชีและภาษี{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            ไม่ยากอีกต่อไป
          </span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          แค่ถ่ายรูปใบเสร็จ TaxBot จัดการทุกอย่างให้ — บันทึกรายรับรายจ่าย
          คำนวณภาษี ซิงค์ Google Sheets โดยไม่ต้องมีความรู้บัญชีเลย
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shadow-lg shadow-emerald-500/25"
          >
            🚀 เริ่มต้นใช้งานฟรี
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
          >
            ดูราคา ↓
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 mt-14">
          {[
            { value: "ฟรี 100%", label: "ไม่มีค่าใช้จ่าย" },
            { value: "< 30 วิ", label: "บันทึกต่อรายการ" },
            { value: "3 แพลตฟอร์ม", label: "รองรับ TikTok, Shopee, Lazada" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-gray-500 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">ทุกอย่างที่ร้านค้าออนไลน์ต้องการ</h2>
          <p className="text-gray-400 text-base">ครบในที่เดียว ใช้งานง่าย ไม่ต้องมีนักบัญชี</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`bg-gradient-to-br ${f.color} border rounded-2xl p-6`}
            >
              <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${f.badge} mb-4`}>
                {f.emoji} {f.title}
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">ราคาที่เหมาะกับทุกขนาดธุรกิจ</h2>
          <p className="text-gray-400 text-base">ทดลองใช้ฟรี 7 วัน · ไม่ต้องผูกบัตรเครดิต</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`relative border rounded-2xl p-6 flex flex-col gap-4 ${plan.color}`}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold px-3 py-1 rounded-full bg-emerald-500 text-white shadow">
                  {plan.badge}
                </div>
              )}

              <div>
                <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-1">{plan.name}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-gray-400 text-sm pb-1">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm ${plan.disabled.includes(i) ? "text-gray-600 line-through" : "text-gray-300"}`}>
                    <span className={`mt-0.5 flex-shrink-0 ${plan.disabled.includes(i) ? "text-gray-600" : "text-emerald-400"}`}>
                      {plan.disabled.includes(i) ? "✕" : "✓"}
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/onboarding"
                className={`w-full text-center py-3 rounded-xl text-sm font-bold transition-colors ${plan.btnClass}`}
              >
                {plan.name === "Free" ? "เริ่มทดลองใช้ฟรี" : "เลือกแพ็กเกจนี้"}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          * ทุกแพ็กเกจเริ่มต้นด้วยช่วงทดลอง 7 วันเต็ม (ทุกฟีเจอร์)
        </p>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">เริ่มต้นใน 3 ขั้นตอน</h2>
          <p className="text-gray-400 text-base">ตั้งค่าครั้งเดียว ใช้ได้ทันที</p>
        </div>

        <div className="flex flex-col gap-4">
          {STEPS.map((s, i) => (
            <div key={s.no} className="flex items-start gap-5 bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center text-emerald-400 font-bold text-lg">
                {s.no}
              </div>
              <div>
                <h3 className="font-bold text-white text-lg mb-1">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden sm:flex ml-auto items-center text-gray-600 text-2xl">↓</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="max-w-2xl mx-auto bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 border border-emerald-500/30 rounded-3xl p-10 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <h2 className="text-3xl font-bold mb-3">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
          <p className="text-gray-400 mb-8 leading-relaxed">
            ใช้งานฟรีผ่าน LINE — ไม่ต้องดาวน์โหลดแอป ไม่ต้องสมัครใหม่
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors shadow-lg shadow-emerald-500/25"
          >
            🚀 เริ่มต้นใช้งานฟรี
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 px-6 py-8 text-center text-gray-600 text-sm">
        <p>© {new Date().getFullYear()} TaxBot · สร้างสำหรับร้านค้าออนไลน์ไทย</p>
      </footer>

    </main>
  );
}
