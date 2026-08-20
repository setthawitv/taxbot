import Link from "next/link";
import {
  VendeeLogo, IconArrowRight, IconCheck,
  IconMusic, IconCart, IconBag, IconGoogleSheets, IconInbox, IconCard, IconSparkle, IconShield,
} from "@/components/icons";

export const metadata = {
  title: "พันธมิตรและการเชื่อมต่อ · Vendee Finance",
  description: "Vendee Finance เป็น TikTok Shop Partner เชื่อมต่อร้านค้าและเครื่องมือครบวงจร",
};

type Item = {
  Icon: React.ComponentType<{ className?: string }>;
  name: string;
  desc: string;
  status: "live" | "soon";
  tint: string;
};

const MARKETPLACES: Item[] = [
  { Icon: IconMusic, name: "TikTok Shop", desc: "ดึงออเดอร์ สินค้า/สต็อก และยอดเงินเข้าจริง ผ่าน API ทางการ", status: "live", tint: "bg-gray-900 text-white" },
  { Icon: IconCart,  name: "Shopee",      desc: "ซิงค์คำสั่งซื้อและสต็อกอัตโนมัติ", status: "soon", tint: "bg-orange-500 text-white" },
  { Icon: IconBag,   name: "Lazada",      desc: "ซิงค์คำสั่งซื้อและสต็อกอัตโนมัติ", status: "soon", tint: "bg-blue-600 text-white" },
];

const TOOLS: Item[] = [
  { Icon: IconGoogleSheets, name: "Google Sheets", desc: "ซิงค์รายรับรายจ่ายเป็นสเปรดชีตของคุณเอง", status: "live", tint: "bg-emerald-600 text-white" },
  { Icon: IconInbox,        name: "LINE OA",        desc: "แจ้งเตือน สแกนสลิป และดูยอดผ่าน LINE", status: "live", tint: "bg-green-500 text-white" },
  { Icon: IconCard,         name: "Beam (PromptPay)", desc: "รับชำระเงินและอัปเกรดแพ็กเกจผ่าน QR", status: "live", tint: "bg-violet-600 text-white" },
  { Icon: IconSparkle,      name: "AI อ่านใบเสร็จ",  desc: "อ่านสลิป/ใบเสร็จอัตโนมัติด้วย AI", status: "live", tint: "bg-cyan-600 text-white" },
];

function Card({ it }: { it: Item }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
      <div className="flex items-start gap-3">
        <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 ${it.tint}`}>
          <it.Icon className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-gray-900">{it.name}</p>
            {it.status === "live" ? (
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">เชื่อมต่อแล้ว</span>
            ) : (
              <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">เร็วๆ นี้</span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{it.desc}</p>
        </div>
      </div>
    </div>
  );
}

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
      <section className="px-6 pt-12 pb-14 max-w-4xl mx-auto text-center">
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

      {/* Marketplaces */}
      <section className="px-6 pb-12 max-w-5xl mx-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">แพลตฟอร์มการขาย</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MARKETPLACES.map((it) => <Card key={it.name} it={it} />)}
        </div>
      </section>

      {/* Tools */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">เครื่องมือที่เชื่อมต่อ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOOLS.map((it) => <Card key={it.name} it={it} />)}
        </div>
      </section>

      {/* Why */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { Icon: IconCheck,  t: "ผ่าน API ทางการ", d: "ข้อมูลตรงจากแพลตฟอร์ม ไม่ต้องกรอกมือ" },
              { Icon: IconShield, t: "ปลอดภัย เชื่อมเมื่อคุณอนุญาต", d: "เข้าถึงเฉพาะเมื่อคุณกดยินยอม ถอนสิทธิ์ได้ทุกเมื่อ" },
              { Icon: IconSparkle, t: "อัตโนมัติทั้งหมด", d: "รายรับ ค่าธรรมเนียม สต็อก และภาษี คำนวณให้เอง" },
            ].map((b) => (
              <div key={b.t} className="text-center">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 mb-3">
                  <b.Icon className="w-6 h-6" />
                </span>
                <p className="font-bold text-gray-900">{b.t}</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="px-6 pb-16 max-w-5xl mx-auto">
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
