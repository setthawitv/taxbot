import Link from "next/link";

export default function Phasi() {
  return (
    <main className="min-h-screen bg-blue-50 flex flex-col px-4 py-8">
      <div className="w-full max-w-sm mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-blue-600 text-sm">← กลับ</Link>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">📊</div>
          <div>
            <h1 className="text-xl font-bold text-blue-700">ภาษี</h1>
            <p className="text-blue-500 text-sm">Tax</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 text-center text-gray-400 border border-blue-100">
          <p className="text-3xl mb-2">📭</p>
          <p>ยังไม่มีข้อมูลภาษี</p>
          <p className="text-sm mt-1">No tax data yet</p>
        </div>
      </div>
    </main>
  );
}
