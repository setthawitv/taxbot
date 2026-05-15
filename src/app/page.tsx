import Link from "next/link";

const sections = [
  {
    href: "/rairab",
    label: "รายรับ",
    sublabel: "Income",
    icon: "💰",
    bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
    iconBg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  {
    href: "/raijhai",
    label: "รายจ่าย",
    sublabel: "Expense",
    icon: "🧾",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
    iconBg: "bg-rose-100",
    text: "text-rose-700",
  },
  {
    href: "/phasi",
    label: "ภาษี",
    sublabel: "Tax",
    icon: "📊",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    iconBg: "bg-blue-100",
    text: "text-blue-700",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🤖</div>
          <h1 className="text-2xl font-bold text-gray-800">TaxBot</h1>
          <p className="text-gray-500 text-sm mt-1">บันทึกรายรับ-รายจ่าย และสรุปภาษี</p>
        </div>

        <div className="flex flex-col gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`flex items-center gap-4 p-5 rounded-2xl border transition-colors ${s.bg}`}
            >
              <div className={`text-3xl w-14 h-14 flex items-center justify-center rounded-xl ${s.iconBg}`}>
                {s.icon}
              </div>
              <div>
                <div className={`text-xl font-semibold ${s.text}`}>{s.label}</div>
                <div className="text-gray-400 text-sm">{s.sublabel}</div>
              </div>
              <div className="ml-auto text-gray-300 text-xl">›</div>
            </Link>
          ))}
        </div>

        <Link
          href="/settings"
          className="mt-4 flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-sm py-3 transition-colors"
        >
          ⚙️ ตั้งค่าบัญชี
        </Link>
      </div>
    </main>
  );
}
