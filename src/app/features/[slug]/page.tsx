import Link from "next/link";
import { notFound } from "next/navigation";

type FeatureStep = { icon: string; title: string; desc: string };
type FeatureData = {
  slug: string;
  emoji: string;
  title: string;
  tagline: string;
  color: string;
  accentText: string;
  accentBg: string;
  description: string;
  steps: FeatureStep[];
  tips: string[];
  cta: string;
};

const FEATURES: FeatureData[] = [
  {
    slug: "scan",
    emoji: "📸",
    title: "สแกนใบเสร็จด้วย AI",
    tagline: "ถ่ายรูปเดียว บันทึกทุกอย่างให้อัตโนมัติ",
    color: "from-purple-900/60 to-gray-950",
    accentText: "text-purple-400",
    accentBg: "bg-purple-500/10 border-purple-500/30",
    description:
      "ไม่ต้องพิมพ์เองอีกต่อไป เพียงถ่ายรูปสลิปโอนเงินหรืออัปโหลดใบเสร็จ AI จะอ่านข้อมูลทุกอย่างและบันทึกลงระบบให้อัตโนมัติ ใช้ได้ทั้งกล้องถ่ายสด และรูปจากคลัง",
    steps: [
      { icon: "1️⃣", title: "ไปที่หน้ารายจ่าย หรือรายรับ", desc: "กดปุ่ม 📸 สแกน ที่มุมขวาบน" },
      { icon: "2️⃣", title: "ถ่ายรูปหรืออัปโหลด", desc: "ใช้กล้องถ่ายใบเสร็จสด หรือเลือกรูปจากคลังภาพ (JPG, PNG, HEIC)" },
      { icon: "3️⃣", title: "AI อ่านข้อมูล", desc: "ระบบจะดึง ยอดเงิน, ชื่อร้านค้า, วันที่, ประเภทเอกสาร และหมวดหมู่" },
      { icon: "4️⃣", title: "ตรวจสอบและบันทึก", desc: "ข้อมูลจะถูกเติมในฟอร์มให้อัตโนมัติ ตรวจสอบแล้วกดบันทึกได้เลย" },
    ],
    tips: [
      "ถ่ายรูปในที่มีแสงพอ ตัวเลขชัด อ่านง่าย",
      "รองรับสลิปโอนเงิน, ใบเสร็จร้านค้า, ใบกำกับภาษี",
      "AI ดึง VAT และภาษีหัก ณ ที่จ่ายด้วยถ้ามีในเอกสาร",
    ],
    cta: "ลองสแกนใบเสร็จเลย",
  },
  {
    slug: "income-expense",
    emoji: "💰",
    title: "ติดตามรายรับ-รายจ่าย",
    tagline: "เห็นภาพรวมธุรกิจแบบ real-time",
    color: "from-emerald-900/60 to-gray-950",
    accentText: "text-emerald-400",
    accentBg: "bg-emerald-500/10 border-emerald-500/30",
    description:
      "ดูยอดรายรับ-รายจ่าย กำไร-ขาดทุน แยกตามเดือน แยกตามแพลตฟอร์ม ทั้งหมดในหน้าเดียว อัปเดตทันทีทุกครั้งที่มีการบันทึก",
    steps: [
      { icon: "1️⃣", title: "บันทึกรายรับ", desc: "นำเข้าไฟล์ Excel จาก TikTok/Shopee/Lazada หรือบันทึก Manual ก็ได้" },
      { icon: "2️⃣", title: "บันทึกรายจ่าย", desc: "พิมพ์เอง สแกนใบเสร็จ หรือให้พนักงาน Staff บันทึกแทน" },
      { icon: "3️⃣", title: "ดูสรุปรายเดือน/รายปี", desc: "Dashboard แสดงยอดรวม กำไร และแนวโน้มแบบกราฟ" },
      { icon: "4️⃣", title: "กรองตามแพลตฟอร์ม", desc: "แยกดูยอด TikTok, Shopee, Lazada หรือ Manual แยกกันได้" },
    ],
    tips: [
      "กดที่แท่งกราฟรายเดือนเพื่อ filter เฉพาะเดือนนั้น",
      "ยอดรวมคำนวณจากทุก platform รวมกันอัตโนมัติ",
      "บันทึกปรับยอด (+/-) ได้สำหรับยอดที่ต้องแก้ไข",
    ],
    cta: "ดูรายรับ-รายจ่าย",
  },
  {
    slug: "tax",
    emoji: "📊",
    title: "คำนวณภาษีอัตโนมัติ",
    tagline: "รู้ล่วงหน้าว่าต้องเสียภาษีเท่าไหร่",
    color: "from-blue-900/60 to-gray-950",
    accentText: "text-blue-400",
    accentBg: "bg-blue-500/10 border-blue-500/30",
    description:
      "ระบบคำนวณภาษีเงินได้บุคคลธรรมดาจากรายได้จริงที่คุณบันทึกไว้ เปรียบเทียบ 2 วิธีหักค่าใช้จ่าย พร้อมบอกว่าแบบไหนประหยัดภาษีมากกว่า",
    steps: [
      { icon: "1️⃣", title: "บันทึกรายรับ-รายจ่ายตลอดปี", desc: "ยิ่งข้อมูลครบ ยิ่งคำนวณแม่นยำ" },
      { icon: "2️⃣", title: "เปิดหน้าภาษี", desc: "ระบบดึงยอดรวมรายได้และรายจ่ายของปีนั้นมาคำนวณให้เลย" },
      { icon: "3️⃣", title: "เปรียบเทียบ 2 วิธี", desc: "วิธีที่ 1: หักค่าใช้จ่าย 60% (จริง) / วิธีที่ 2: หักแบบเหมา" },
      { icon: "4️⃣", title: "รู้ยอดภาษีโดยประมาณ", desc: "แนะนำล่วงหน้าก่อนถึงกำหนดยื่น ภ.ง.ด.90/91" },
    ],
    tips: [
      "ยอดภาษีที่แสดงเป็นประมาณการ — ยื่นจริงควรปรึกษานักบัญชี",
      "ระบบใช้อัตราภาษีก้าวหน้าของไทย ปี 2025",
      "VAT threshold: รายได้เกิน 1.8 ล้าน/ปี ต้องจด VAT",
    ],
    cta: "ดูสรุปภาษีของฉัน",
  },
  {
    slug: "sheets",
    emoji: "📋",
    title: "ซิงค์ Google Sheets",
    tagline: "ข้อมูลทุกรายการพร้อมใน Spreadsheet ของคุณ",
    color: "from-green-900/60 to-gray-950",
    accentText: "text-green-400",
    accentBg: "bg-green-500/10 border-green-500/30",
    description:
      "ทุกรายการที่บันทึกจะถูกส่งไปยัง Google Sheets ของคุณอัตโนมัติ ดาวน์โหลดเป็น Excel แชร์กับนักบัญชีหรือสรรพากรได้ทันที ไม่ต้องพิมพ์ซ้ำ",
    steps: [
      { icon: "1️⃣", title: "เชื่อมต่อ Google", desc: "ไปที่ ตั้งค่า → เชื่อมต่อ Google และให้สิทธิ์เข้าถึง Drive" },
      { icon: "2️⃣", title: "ระบบสร้าง Sheet ให้อัตโนมัติ", desc: "สร้าง Google Sheet ชื่อ \"TaxBot - [ชื่อธุรกิจ]\" ใน Drive ของคุณ" },
      { icon: "3️⃣", title: "ซิงค์อัตโนมัติ", desc: "ทุกรายการที่บันทึกจะถูก append ลง Sheet ทันที" },
      { icon: "4️⃣", title: "เปิดหรือแชร์ได้เลย", desc: "กด Google Sheets ใน Dashboard เพื่อเปิด หรือ Share URL ให้นักบัญชี" },
    ],
    tips: [
      "กด Sync ใน Settings เพื่อนำรายการเก่าเข้า Sheets ย้อนหลัง",
      "Sheet แยก tab รายรับ / รายจ่าย / สรุปรายเดือน",
      "ดาวน์โหลดเป็น .xlsx ได้จาก Google Sheets โดยตรง",
    ],
    cta: "เชื่อมต่อ Google Sheets",
  },
  {
    slug: "import",
    emoji: "📤",
    title: "นำเข้ายอดแพลตฟอร์ม",
    tagline: "อัปโหลดครั้งเดียว ได้รายรับทั้งเดือน",
    color: "from-orange-900/60 to-gray-950",
    accentText: "text-orange-400",
    accentBg: "bg-orange-500/10 border-orange-500/30",
    description:
      "ดาวน์โหลดรายงานยอดขายจาก TikTok Shop, Shopee หรือ Lazada แล้วอัปโหลดเข้า TaxBot — ระบบจะแยกยอดรายรับของแต่ละออเดอร์ให้อัตโนมัติ ไม่ต้องกรอกทีละรายการ",
    steps: [
      { icon: "1️⃣", title: "ดาวน์โหลดรายงานจากแพลตฟอร์ม", desc: "TikTok: Order Management → Export / Shopee: My Income → Export / Lazada: Orders → Export" },
      { icon: "2️⃣", title: "ไปที่หน้ารายรับ → นำเข้า", desc: "กดปุ่ม 📤 นำเข้า แล้วเลือกแพลตฟอร์มที่ต้องการ" },
      { icon: "3️⃣", title: "เลือกไฟล์ Excel/CSV", desc: "ระบบจะอ่านและแยกออเดอร์ทั้งหมดในไฟล์" },
      { icon: "4️⃣", title: "ยืนยันและบันทึก", desc: "ตรวจสอบยอดรวม แล้วกดยืนยัน — รายรับทั้งหมดจะเข้าระบบทันที" },
    ],
    tips: [
      "ระบบตรวจสอบ Order ID ซ้ำ ป้องกันการนับยอดสองครั้ง",
      "รองรับไฟล์ .xlsx และ .csv จากทุกแพลตฟอร์ม",
      "แนะนำให้ import ทุกสิ้นเดือน เพื่อให้ยอดภาษีถูกต้อง",
    ],
    cta: "นำเข้าไฟล์ยอดขาย",
  },
  {
    slug: "team",
    emoji: "🛡️",
    title: "แชร์ให้ทีมงาน",
    tagline: "ทำงานร่วมกันได้โดยไม่ต้องแชร์รหัส",
    color: "from-rose-900/60 to-gray-950",
    accentText: "text-rose-400",
    accentBg: "bg-rose-500/10 border-rose-500/30",
    description:
      "เพิ่มผู้ดูแลร่วม (Admin) ด้วย Google Email เพื่อให้เข้าถึง Dashboard ได้เต็มที่ หรือสร้างลิงก์ Staff สำหรับให้พนักงานบันทึกรายจ่ายแทนโดยไม่ต้อง login",
    steps: [
      { icon: "1️⃣", title: "Admin — เพิ่มผู้ดูแลร่วม", desc: "ไปที่ ตั้งค่า → Admin → ใส่ Gmail ของผู้ที่จะเพิ่ม → คัดลอกลิงก์เชิญ" },
      { icon: "2️⃣", title: "Admin ยืนยันตัวตน", desc: "Admin เปิดลิงก์ → ล็อกอินด้วย Google → ยืนยันการเข้าร่วม" },
      { icon: "3️⃣", title: "Staff — บันทึกรายจ่ายแทน", desc: "สร้างลิงก์ Staff ใน Settings → ส่งให้พนักงาน → กรอกชื่อแล้วบันทึกได้เลย ไม่ต้อง login" },
      { icon: "4️⃣", title: "เห็นว่าใครบันทึก", desc: "รายจ่ายที่บันทึกโดย Staff จะมีแท็กชื่อกำกับในรายการ" },
    ],
    tips: [
      "Admin เข้าถึงได้ทุกอย่าง — รายรับ, รายจ่าย, ภาษี, ตั้งค่า",
      "ลิงก์ Staff ไม่ต้องล็อกอิน — เหมาะสำหรับพนักงานทั่วไป",
      "รีเซ็ตหรือปิดลิงก์ Staff ได้ตลอดเวลาใน Settings",
    ],
    cta: "ตั้งค่าการเข้าถึงทีม",
  },
];

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export default function FeaturePage({ params }: { params: { slug: string } }) {
  const feature = FEATURES.find((f) => f.slug === params.slug);
  if (!feature) notFound();

  return (
    <main className={`min-h-screen bg-gradient-to-b ${feature.color} text-white`}>
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Back */}
        <Link href="/landing" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors mb-8">
          ← กลับหน้าหลัก
        </Link>

        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-7xl mb-4">{feature.emoji}</div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">{feature.title}</h1>
          <p className={`text-lg font-medium ${feature.accentText}`}>{feature.tagline}</p>
          <p className="text-gray-400 mt-4 leading-relaxed">{feature.description}</p>
        </div>

        {/* Steps */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4">วิธีใช้งาน</h2>
          <div className="space-y-3">
            {feature.steps.map((s) => (
              <div key={s.title} className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
                <span className="text-2xl flex-shrink-0">{s.icon}</span>
                <div>
                  <p className="font-semibold text-white">{s.title}</p>
                  <p className="text-gray-400 text-sm mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className={`border rounded-2xl p-5 mb-8 ${feature.accentBg}`}>
          <h2 className="text-sm font-bold mb-3 text-gray-300">💡 เคล็ดลับ</h2>
          <ul className="space-y-2">
            {feature.tips.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-gray-300">
                <span className={`mt-0.5 flex-shrink-0 ${feature.accentText}`}>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Link
          href="/onboarding"
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
        >
          🚀 {feature.cta}
        </Link>

        {/* Other features */}
        <div className="mt-10">
          <p className="text-xs text-gray-600 uppercase tracking-wide font-semibold mb-3">ฟีเจอร์อื่นๆ</p>
          <div className="flex flex-wrap gap-2">
            {FEATURES.filter((f) => f.slug !== feature.slug).map((f) => (
              <Link
                key={f.slug}
                href={`/features/${f.slug}`}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 transition-colors"
              >
                {f.emoji} {f.title}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
