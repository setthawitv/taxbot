"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SLIDES = [
  {
    emoji: "🤖",
    badge: "หน้า 1 / 4",
    titleHighlight: "TaxBot มาช่วยจัดการ",
    titleNormal: "รายรับ-รายจ่าย และภาษี แล้วจ้า~",
    description:
      "ส่งสลิปหรือรูปใบเสร็จในไลน์ ผมจะอ่านและบันทึกรายรับ-รายจ่าย คำนวณภาษี และเก็บข้อมูลอัตโนมัติใน Google Sheets ของคุณ",
    preview: (
      <div className="bg-gray-50 rounded-2xl p-4 w-full max-w-xs mx-auto text-sm">
        <div className="bg-green-100 text-green-800 rounded-xl px-3 py-2 mb-2 inline-flex items-center gap-2 text-xs font-medium">
          ✅ บันทึกรายรับสำเร็จ
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-xs space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">จำนวนเงิน</span><span className="font-semibold">1,500.00 THB</span></div>
          <div className="flex justify-between"><span className="text-gray-500">ร้านค้า</span><span className="font-semibold">Shopee</span></div>
          <div className="flex justify-between"><span className="text-gray-500">วันที่</span><span className="font-semibold">16 พ.ค. 2568</span></div>
          <div className="flex justify-between"><span className="text-gray-500">ประเภท</span><span className="font-semibold text-green-600">💰 รายรับ</span></div>
        </div>
      </div>
    ),
  },
  {
    emoji: "🏷️",
    badge: "หน้า 2 / 4",
    titleHighlight: "จัดหมวดหมู่รายรับ-รายจ่าย",
    titleNormal: "ได้ตามใจ 💙",
    description:
      "กำหนดกฎ vendor ว่าร้านไหนเป็นรายรับหรือรายจ่าย TaxBot จะจัดหมวดหมู่อัตโนมัติทุกครั้ง ไม่ต้องจำเอง",
    preview: (
      <div className="bg-gray-50 rounded-2xl p-4 w-full max-w-xs mx-auto text-xs space-y-2">
        <p className="font-semibold text-gray-700 text-sm mb-3">🏷️ กฎ Vendor ของคุณ</p>
        {[
          { name: "Shopee", type: "รายรับ", color: "text-green-600 bg-green-50" },
          { name: "Kerry Express", type: "รายจ่าย", color: "text-red-600 bg-red-50" },
          { name: "TikTok Shop", type: "รายรับ", color: "text-green-600 bg-green-50" },
        ].map((v) => (
          <div key={v.name} className="bg-white rounded-xl px-3 py-2 shadow-sm flex items-center justify-between">
            <span className="font-medium text-gray-700">{v.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${v.color}`}>{v.type}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    emoji: "📸",
    badge: "หน้า 3 / 4",
    titleHighlight: "AI อ่านสลิป",
    titleNormal: "บันทึกอัตโนมัติทันที ✨",
    description:
      "แค่ถ่ายรูปสลิปหรือใบเสร็จแล้วส่งในไลน์ AI จะอ่านข้อมูลและบันทึกให้ทันที ไม่ต้องพิมพ์เอง ไม่พลาดทุกรายการ",
    preview: (
      <div className="bg-gray-50 rounded-2xl p-4 w-full max-w-xs mx-auto text-xs">
        <p className="font-semibold text-gray-700 text-sm mb-3">📊 ยอดรวมเดือนนี้</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <p className="text-green-600 font-bold text-base">฿12,500</p>
            <p className="text-gray-500 mt-1">💰 รายรับ</p>
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <p className="text-red-600 font-bold text-base">฿3,200</p>
            <p className="text-gray-500 mt-1">🧾 รายจ่าย</p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-3 mt-2 text-center">
          <p className="text-blue-700 font-semibold">คงเหลือ ฿9,300</p>
        </div>
      </div>
    ),
  },
  {
    emoji: "📊",
    badge: "หน้า 4 / 4",
    titleHighlight: "สรุปภาษีอัตโนมัติ",
    titleNormal: "ไม่ต้องคำนวณเอง 🧾",
    description:
      "TaxBot คำนวณภาษีตามอัตราภาษีเงินได้บุคคลธรรมดา 2568 อัตโนมัติ พร้อมแจ้งเตือนรายเดือนและสรุปที่ต้องยื่น",
    preview: (
      <div className="bg-gray-50 rounded-2xl p-4 w-full max-w-xs mx-auto text-xs space-y-2">
        <p className="font-semibold text-gray-700 text-sm mb-3">📊 ประมาณการภาษี 2568</p>
        {[
          { label: "รายได้สุทธิ", value: "฿120,000", color: "text-gray-800" },
          { label: "หักค่าใช้จ่าย 60%", value: "−฿72,000", color: "text-red-500" },
          { label: "หักค่าลดหย่อนส่วนตัว", value: "−฿60,000", color: "text-red-500" },
          { label: "ภาษีที่ต้องชำระ", value: "฿0", color: "text-green-600 font-bold" },
        ].map((r) => (
          <div key={r.label} className="bg-white rounded-xl px-3 py-2 shadow-sm flex justify-between">
            <span className="text-gray-500">{r.label}</span>
            <span className={r.color}>{r.value}</span>
          </div>
        ))}
      </div>
    ),
  },
];

export default function IntroPage() {
  const [slide, setSlide] = useState(0);
  const router = useRouter();
  const isLast = slide === SLIDES.length - 1;
  const s = SLIDES[slide];

  function next() {
    if (isLast) {
      router.push("/onboarding");
    } else {
      setSlide((i) => i + 1);
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8">
      {/* Preview card */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {s.preview}
      </div>

      {/* Text content */}
      <div className="mt-4">
        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
          {s.badge}
        </span>

        <h2 className="mt-3 text-2xl font-bold text-gray-900 leading-tight">
          <span className="text-blue-600">{s.titleHighlight}</span>{" "}
          {s.titleNormal}
        </h2>

        <p className="mt-2 text-gray-500 text-sm leading-relaxed">{s.description}</p>
      </div>

      {/* Navigation */}
      <div className="mt-6">
        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mb-5">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === slide ? "w-6 bg-gray-900" : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-4">
          {slide > 0 ? (
            <button
              onClick={() => setSlide((i) => i - 1)}
              className="text-sm font-medium text-blue-600 flex-shrink-0"
            >
              ย้อนกลับ
            </button>
          ) : (
            <div className="flex-shrink-0 w-16" />
          )}
          <button
            onClick={next}
            className="flex-1 bg-gray-900 text-white font-semibold py-3.5 rounded-2xl hover:bg-gray-800 active:scale-95 transition-all"
          >
            {isLast ? "เริ่มใช้งาน" : "ต่อไป"}
          </button>
        </div>
      </div>
    </main>
  );
}
