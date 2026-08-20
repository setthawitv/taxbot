import Link from "next/link";
import { VendeeLogo, IconArrowRight, IconCheck } from "@/components/icons";

export const metadata = {
  title: "พันธมิตรและการเชื่อมต่อ · Vendee Finance",
  description: "Vendee Finance เป็น TikTok Shop Partner เชื่อมต่อร้านค้าและเครื่องมือครบวงจร",
};

const TOOLS: { name: string; desc: string }[] = [
  { name: "Google Sheets",   desc: "ซิงค์รายรับรายจ่ายเป็นสเปรดชีตของคุณเอง" },
  { name: "LINE OA",         desc: "แจ้งเตือน สแกนสลิป และดูยอดผ่าน LINE" },
  { name: "Beam (PromptPay)", desc: "รับชำระเงินและอัปเกรดแพ็กเกจผ่าน QR" },
  { name: "AI อ่านใบเสร็จ",   desc: "อ่านสลิป/ใบเสร็จอัตโนมัติด้วย AI" },
];

export default function PartnerPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-gray-900">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <VendeeLogo className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight text-[#0A192F]">Vendee Finance</span>
        </Link>
        <Link href="/onboarding"
          className="text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-400 px-4 py-2 rounded-xl transition-colors">
          เริ่มต้นใช้งานฟรี
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-12 pb-14 max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-500 text-white text-xs font-bold px-3.5 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 rounded-full bg-white" /> TikTok Shop Partner
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-5">
          พันธมิตรและการเชื่อมต่อ{" "}
          <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">ครบวงจร</span>
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">
          Vendee Finance เชื่อมต่อร้านค้าและเครื่องมือที่คุณใช้อยู่ — ดึงออเดอร์ สต็อก
          และยอดเงินเข้าจริงผ่าน API ทางการ เพื่อทำบัญชีและภาษีให้อัตโนมัติ
        </p>
        <p className="text-sm text-gray-400 mt-4">
          บริการ &quot;Vendee Finance&quot; เผยแพร่บน TikTok Shop Service Market ผ่าน TikTok Shop Partner Center
        </p>
      </section>

      {/* Marketplace — TikTok Shop (featured, text-forward) */}
      <section className="px-6 pb-12 max-w-4xl mx-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">แพลตฟอร์มการขาย</h2>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5 mb-3">
            <p className="text-2xl font-extrabold text-[#0A192F]">TikTok Shop</p>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">เชื่อมต่อแล้ว</span>
            <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2.5 py-1">เผยแพร่บน Service Market</span>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed mb-5">
            Vendee Finance เชื่อมต่อ TikTok Shop ผ่าน API ทางการ (TikTok Shop Partner Center) —
            ดึงข้อมูลเข้าระบบให้อัตโนมัติ ไม่ต้องกรอกมือ
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {[
              "ออเดอร์ → รายรับอัตโนมัติ",
              "สินค้า/สต็อก แบบเรียลไทม์",
              "ค่าธรรมเนียม (GP) รายออเดอร์",
              "ยอดเงินเข้าจริงหลังหักค่าธรรมเนียม",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                <IconCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools — clean rows, no icons */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">เครื่องมือที่เชื่อมต่อ</h2>
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {TOOLS.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{t.desc}</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 flex-shrink-0">
                <IconCheck className="w-4 h-4 text-emerald-500" /> เชื่อมต่อแล้ว
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Why */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { t: "ผ่าน API ทางการ", d: "ข้อมูลตรงจากแพลตฟอร์ม ไม่ต้องกรอกมือ" },
            { t: "เชื่อมเมื่อคุณอนุญาต", d: "เข้าถึงเฉพาะเมื่อคุณกดยินยอม ถอนสิทธิ์ได้ทุกเมื่อ" },
            { t: "อัตโนมัติทั้งหมด", d: "รายรับ ค่าธรรมเนียม สต็อก และภาษี คำนวณให้เอง" },
          ].map((b) => (
            <div key={b.t} className="bg-white border border-gray-200 rounded-2xl p-5">
              <p className="font-bold text-gray-900">{b.t}</p>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 pb-16 max-w-4xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-8 sm:p-12 shadow-lg shadow-emerald-500/20 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="text-white">
              <h2 className="text-2xl sm:text-3xl font-extrabold leading-snug">พร้อมเชื่อมร้านของคุณแล้วหรือยัง?</h2>
              <p className="text-white/85 mt-2 text-sm sm:text-base">สมัครฟรี เชื่อม TikTok Shop แล้วให้ Vendee ทำบัญชีให้อัตโนมัติ</p>
            </div>
            <div className="flex flex-shrink-0 gap-3">
              <a href="mailto:admin@vendeefinance.com"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-sm font-bold bg-white text-emerald-700 hover:bg-emerald-50 transition-colors">
                ติดต่อเรา
              </a>
              <Link href="/onboarding"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[#0A192F] text-white hover:bg-[#0d2242] transition-colors">
                ทดลองใช้ฟรี <IconArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8 text-center text-gray-500 text-sm space-y-2">
        <div className="flex justify-center gap-5 text-xs">
          <Link href="/" className="hover:text-gray-800 transition-colors">หน้าแรก</Link>
          <Link href="/privacy" className="hover:text-gray-800 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-800 transition-colors">Terms of Service</Link>
        </div>
        <p>{new Date().getFullYear()} Vendee Finance · TikTok Shop Partner</p>
      </footer>
    </main>
  );
}
