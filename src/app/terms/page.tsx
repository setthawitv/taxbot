import Link from "next/link";
import { VendeeLogo, IconArrowRight } from "@/components/icons";

export const metadata = {
  title: "Terms of Service · Vendee Finance",
  description: "ข้อกำหนดและเงื่อนไขการใช้งาน Vendee Finance",
};

const UPDATED = "1 มกราคม 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      {/* Header */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <VendeeLogo className="w-8 h-8" />
          <span className="font-bold text-lg tracking-tight text-white">Vendee Finance</span>
        </Link>
        <Link href="/onboarding"
          className="text-sm font-semibold text-gray-300 hover:text-white inline-flex items-center gap-1">
          เข้าสู่ระบบ <IconArrowRight className="w-4 h-4" />
        </Link>
      </nav>

      <article className="max-w-3xl mx-auto px-6 py-10">

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm">ข้อกำหนดและเงื่อนไขการใช้งาน · อัปเดตล่าสุด {UPDATED}</p>
        </header>

        <section className="space-y-5 text-sm leading-relaxed">

          <p>
            ยินดีต้อนรับสู่ Vendee Finance การใช้บริการของเราหมายความว่าคุณยอมรับเงื่อนไขด้านล่างนี้
            หากไม่ยอมรับ กรุณาหยุดใช้งานทันที
          </p>

          <h2 className="text-lg font-bold text-white mt-8">1. คำจำกัดความ</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>"แอพ"</strong> = Vendee Finance รวมทั้งเว็บไซต์, LINE Bot และ Mini App</li>
            <li><strong>"ผู้ใช้"</strong> = บุคคลที่ลงทะเบียนใช้บริการ Vendee Finance</li>
            <li><strong>"ข้อมูลผู้ใช้"</strong> = ข้อมูลทั้งหมดที่ผู้ใช้ป้อนหรืออัปโหลด</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">2. คุณสมบัติของผู้ใช้</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>ต้องมีอายุ 20 ปีบริบูรณ์ หรือได้รับอนุญาตจากผู้ปกครอง</li>
            <li>ต้องให้ข้อมูลที่ถูกต้องและเป็นจริง</li>
            <li>ห้ามใช้บัญชีของผู้อื่นหรือสร้างหลายบัญชีเพื่อหลีกเลี่ยงข้อจำกัด</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">3. การใช้งานที่อนุญาต</h2>
          <p>คุณตกลงว่าจะใช้แอพเพื่อ:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>บันทึกรายรับ-รายจ่ายของธุรกิจตนเองเท่านั้น</li>
            <li>คำนวณภาษีและจัดทำเอกสารทางการบัญชีที่ถูกต้อง</li>
            <li>เก็บเอกสารและใบเสร็จที่ถูกกฎหมาย</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">4. การใช้งานที่ห้าม</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>ห้ามอัปโหลดเอกสารปลอม หลอกลวง หรือใช้เพื่อฟอกเงิน</li>
            <li>ห้าม reverse engineer, แฮก หรือพยายามเข้าถึงระบบโดยไม่ได้รับอนุญาต</li>
            <li>ห้ามใช้แอพในทางที่ละเมิดกฎหมายไทยหรือกฎหมายระหว่างประเทศ</li>
            <li>ห้ามขายต่อหรือให้บริการในนามของ Vendee Finance โดยไม่ได้รับอนุญาต</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">5. ข้อจำกัดความรับผิด (Disclaimer ภาษี)</h2>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-100">
            <p className="font-semibold mb-2">⚠️ ข้อมูลภาษีจาก Vendee Finance เป็น "การประมาณการ" เท่านั้น</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>ตัวเลขที่คำนวณอ้างอิงจากอัตราภาษีของกรมสรรพากร แต่อาจไม่ครอบคลุมทุกกรณี</li>
              <li>ผู้ใช้ต้องตรวจสอบความถูกต้องและปรึกษานักบัญชีก่อนยื่นภาษีจริง</li>
              <li>Vendee Finance ไม่รับผิดชอบความเสียหายจากการนำตัวเลขไปใช้ยื่นภาษี</li>
              <li>เราไม่ใช่นักบัญชีรับอนุญาต ไม่ใช่ที่ปรึกษาภาษี</li>
            </ul>
          </div>

          <h2 className="text-lg font-bold text-white mt-8">6. การชำระเงินและการสมัครสมาชิก</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>แพ็กเกจรายเดือนชำระล่วงหน้า ไม่มีการคืนเงินกรณีใช้งานไม่เต็มเดือน</li>
            <li>ทดลองใช้ฟรี 7 วันสำหรับผู้ใช้ใหม่ ไม่ผูกบัตรเครดิต</li>
            <li>ราคาอาจเปลี่ยนแปลงได้ โดยจะแจ้งล่วงหน้าอย่างน้อย 30 วัน</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">7. ความเป็นเจ้าของข้อมูล</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>ข้อมูลที่คุณป้อนยังคงเป็นของคุณ</li>
            <li>คุณอนุญาตให้ Vendee Finance ใช้ข้อมูลเพื่อให้บริการตามที่อธิบายใน <Link href="/privacy" className="text-blue-400 underline">Privacy Policy</Link></li>
            <li>เมื่อยกเลิกบัญชี ข้อมูลของคุณจะถูกลบภายใน 30 วัน (ยกเว้นที่กฎหมายบังคับให้เก็บ)</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">8. การระงับ/ยกเลิกบัญชี</h2>
          <p>เรามีสิทธิ์ระงับหรือยกเลิกบัญชีหากตรวจพบการละเมิดเงื่อนไข โดยไม่ต้องคืนเงิน</p>

          <h2 className="text-lg font-bold text-white mt-8">9. ทรัพย์สินทางปัญญา</h2>
          <p>โค้ด, ดีไซน์, โลโก้, ชื่อ "Vendee Finance" เป็นทรัพย์สินทางปัญญาของเรา ห้ามคัดลอกหรือดัดแปลงโดยไม่ได้รับอนุญาต</p>

          <h2 className="text-lg font-bold text-white mt-8">10. การเปลี่ยนแปลงเงื่อนไข</h2>
          <p>เราอาจปรับปรุงเงื่อนไขนี้ในอนาคต โดยจะแจ้งล่วงหน้าทางอีเมลหรือใน LINE</p>

          <h2 className="text-lg font-bold text-white mt-8">11. กฎหมายที่ใช้บังคับ</h2>
          <p>เงื่อนไขนี้อยู่ภายใต้กฎหมายไทย กรณีพิพาทใช้ศาลในกรุงเทพมหานครเป็นเขตอำนาจศาล</p>

          <h2 className="text-lg font-bold text-white mt-8">12. ติดต่อเรา</h2>
          <p>
            <strong>Email:</strong> <a className="text-blue-400 underline" href="mailto:admin@vendeefinance.com">admin@vendeefinance.com</a>
          </p>
        </section>

        <footer className="mt-16 pt-6 border-t border-white/10 text-gray-500 text-xs">
          <p>© {new Date().getFullYear()} Vendee Finance · <Link href="/privacy" className="hover:text-gray-300 underline">Privacy Policy</Link> · <Link href="/" className="hover:text-gray-300 underline">Home</Link></p>
        </footer>
      </article>
    </main>
  );
}
