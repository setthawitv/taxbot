"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import liff from "@line/liff";
import { initLiff, isInLineClient, getLiffUrl } from "@/lib/liff";

// ─── Slide data ────────────────────────────────────────────────────────────────
const SLIDES = [
  {
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

// ─── LINE logo SVG (reused in multiple screens) ────────────────────────────────
function LineLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "w-6 h-6 fill-white"}>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.494.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

// ─── Add Friend screen ─────────────────────────────────────────────────────────
function AddFriendScreen({ onDone }: { onDone: () => void }) {
  const [checking, setChecking] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");

  const oaId = process.env.NEXT_PUBLIC_LINE_OA_ID ?? "";

  function openAddFriend() {
    if (!oaId || oaId === "@YOUR_OA_BASIC_ID") return;
    // Open the OA profile inside LINE (no external browser needed)
    liff.openWindow({
      url: `https://line.me/R/ti/p/${oaId}`,
      external: false,
    });
  }

  async function checkFriendship() {
    setChecking(true);
    setError("");
    try {
      const { friendFlag } = await liff.getFriendship();
      if (friendFlag) {
        setAdded(true);
        setTimeout(onDone, 1000);
      } else {
        setError("ยังไม่พบการเพิ่มเพื่อน กรุณาเพิ่มแล้วลองใหม่");
      }
    } catch {
      // If getFriendship fails (channel not linked), skip this step
      onDone();
    }
    setChecking(false);
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
      {/* Bot mascot */}
      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-5xl mb-6">
        🤖
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">เพิ่ม TaxBot เป็นเพื่อน</h1>
      <p className="text-gray-500 text-sm leading-relaxed mb-8">
        เพิ่มเพื่อนเพื่อรับการแจ้งเตือนภาษี<br />
        และส่งสลิปผ่านแชทได้เลย
      </p>

      {added ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center text-white text-2xl">✓</div>
          <p className="text-green-600 font-semibold mt-2">เพิ่มเพื่อนสำเร็จ!</p>
        </div>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-3">
          {/* Add friend button */}
          <button
            onClick={openAddFriend}
            disabled={!oaId || oaId === "@YOUR_OA_BASIC_ID"}
            className="w-full flex items-center justify-center gap-3 bg-[#06C755] text-white font-bold py-4 rounded-2xl text-base active:scale-95 transition-all shadow-md shadow-green-200 disabled:opacity-50"
          >
            <LineLogo />
            เพิ่มเพื่อน TaxBot
          </button>

          {/* Confirm button */}
          <button
            onClick={checkFriendship}
            disabled={checking}
            className="w-full border-2 border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl hover:border-gray-400 active:scale-95 transition-all disabled:opacity-50"
          >
            {checking ? "กำลังตรวจสอบ..." : "ฉันเพิ่มแล้ว →"}
          </button>

          {error && <p className="text-red-500 text-xs text-center">{error}</p>}

          {/* Skip for existing friends */}
          <button
            onClick={onDone}
            className="text-xs text-gray-400 mt-1 underline"
          >
            ข้ามขั้นตอนนี้
          </button>
        </div>
      )}
    </main>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
type Screen = "loading" | "not-in-line" | "add-friend" | "slides";

function IntroPageInner() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [slide, setSlide] = useState(0);
  const router = useRouter();
  const params = useSearchParams();
  // ?to=/settings allows Rich Menu to open any page via LIFF URL (for LIFF context)
  const redirectTo = params.get("to") ?? "/";
  const isLast = slide === SLIDES.length - 1;
  const s = SLIDES[slide];

  useEffect(() => {
    initLiff()
      .then(async () => {
        if (!isInLineClient()) {
          setScreen("not-in-line");
          return;
        }

        // 1. Get LINE profile
        const profile = await liff.getProfile();

        // 2. Check if this user already completed onboarding in Supabase
        const res = await fetch(`/api/user/status?lineUserId=${profile.userId}`);
        const status = await res.json();

        if (status.onboarded) {
          // Already registered
          document.cookie = "taxbot_onboarded=1; path=/; max-age=31536000";

          // Check for pending Google reconnect triggered from settings (localStorage bridge).
          // This page is always opened via liff.line.me URL so liff.openWindow({ external })
          // works reliably here — unlike the settings page which is opened via direct URL.
          const pendingLid = localStorage.getItem("reconnect_google_lid");
          if (pendingLid) {
            localStorage.removeItem("reconnect_google_lid");
            liff.openWindow({
              url: `${window.location.origin}/connect-google?lid=${pendingLid}`,
              external: true,
            });
            return; // stay on intro — Safari will handle the OAuth
          }

          // Go to requested page (or dashboard)
          router.replace(redirectTo);
          return;
        }

        // 3. New user — check friendship before showing slides
        try {
          const { friendFlag } = await liff.getFriendship();
          setScreen(friendFlag ? "slides" : "add-friend");
        } catch {
          // getFriendship() fails when Login channel isn't linked to OA — skip
          setScreen("slides");
        }
      })
      .catch(() => setScreen("not-in-line"));
  }, [router]);

  function next() {
    if (isLast) router.push("/onboarding");
    else setSlide((i) => i + 1);
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (screen === "loading") {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🤖</div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    );
  }

  // ── Not in LINE ─────────────────────────────────────────────────────────────
  if (screen === "not-in-line") {
    return (
      <main className="min-h-screen bg-white flex flex-col items-center justify-center px-8 text-center">
        <div className="text-6xl mb-6">🤖</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">TaxBot</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          แอปนี้ออกแบบมาสำหรับ LINE<br />
          กรุณาเปิดผ่านแอป LINE เพื่อใช้งาน
        </p>
        <a
          href={getLiffUrl()}
          className="w-full max-w-xs flex items-center justify-center gap-3 bg-[#06C755] text-white font-bold py-4 rounded-2xl text-lg active:scale-95 transition-all shadow-lg shadow-green-200"
        >
          <LineLogo />
          เปิดใน LINE
        </a>
      </main>
    );
  }

  // ── Add friend gate ─────────────────────────────────────────────────────────
  if (screen === "add-friend") {
    return <AddFriendScreen onDone={() => setScreen("slides")} />;
  }

  // ── Feature slides ──────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-white flex flex-col px-6 pt-12 pb-8">
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {s.preview}
      </div>

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

      <div className="mt-6">
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

export default function IntroPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🤖</div>
          <p className="text-gray-400 text-sm">กำลังโหลด...</p>
        </div>
      </main>
    }>
      <IntroPageInner />
    </Suspense>
  );
}
