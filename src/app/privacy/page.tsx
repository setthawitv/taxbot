import Link from "next/link";
import { VendeeLogo, IconArrowRight } from "@/components/icons";

export const metadata = {
  title: "Privacy Policy · Vendee Finance",
  description: "นโยบายความเป็นส่วนตัวของ Vendee Finance",
};

const UPDATED = "1 มกราคม 2026";

export default function PrivacyPolicyPage() {
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

      <article className="max-w-3xl mx-auto px-6 py-10 prose prose-invert prose-headings:text-white prose-strong:text-white">

        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">นโยบายความเป็นส่วนตัว · อัปเดตล่าสุด {UPDATED}</p>
        </header>

        {/* Thai version */}
        <section className="space-y-5 text-sm leading-relaxed">
          <p>
            Vendee Finance ("เรา" / "แอพ") ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้
            เอกสารนี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้ทำอะไร
            และคุณมีสิทธิ์อย่างไรเหนือข้อมูลของคุณ
          </p>

          <h2 className="text-lg font-bold text-white mt-8">1. ข้อมูลที่เราเก็บ</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>ข้อมูลโปรไฟล์</strong> — ชื่อ, อีเมล, รูปโปรไฟล์ (จาก Google / LINE)</li>
            <li><strong>ข้อมูลธุรกิจ</strong> — ชื่อกิจการ, ประเภทผู้เสียภาษี</li>
            <li><strong>รายการบัญชี</strong> — รายรับ-รายจ่ายที่คุณบันทึก, รูปใบเสร็จที่อัปโหลด</li>
            <li><strong>ข้อมูลภาษี</strong> — ค่าลดหย่อน, ตัวเลขที่กรอกในเครื่องคำนวณ</li>
            <li><strong>Google Drive / Sheets</strong> — เฉพาะไฟล์ที่ Vendee Finance สร้างเอง (ผ่าน scope <code>drive.file</code>)</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">2. การใช้งานข้อมูล</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>คำนวณภาษีเงินได้บุคคลธรรมดา/นิติบุคคลตามอัตรากรมสรรพากร</li>
            <li>สร้างและซิงค์ Google Sheet ของผู้ใช้เอง สำหรับเก็บประวัติรายรับ-รายจ่าย</li>
            <li>อัปโหลดใบเสร็จและไฟล์ PDF ที่ระบบสร้างไปยัง Google Drive โฟลเดอร์ของผู้ใช้</li>
            <li>วิเคราะห์ใบเสร็จด้วย AI (เฉพาะรูปที่ผู้ใช้อัปโหลดเอง)</li>
            <li>ส่งการแจ้งเตือนผ่าน LINE OA</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">3. การใช้งาน Google API Services</h2>
          <p>
            Vendee Finance ปฏิบัติตาม <a className="text-blue-400 hover:text-blue-300 underline"
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank" rel="noopener">Google API Services User Data Policy</a>
            รวมถึง Limited Use requirements
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>เราใช้ scope <code>drive.file</code> เท่านั้น — เข้าถึงเฉพาะไฟล์ที่ Vendee Finance สร้างเอง ไม่อ่านไฟล์อื่นใน Drive ของผู้ใช้</li>
            <li>เราไม่นำข้อมูลจาก Google ไปฝึก AI model / Machine Learning ใดๆ</li>
            <li>เราไม่ขายหรือโอนข้อมูลให้บุคคลที่สาม</li>
            <li>เราไม่ใช้ข้อมูลเพื่อโฆษณา</li>
            <li>มนุษย์จะอ่านข้อมูลของผู้ใช้เฉพาะกรณี: (1) ผู้ใช้ยินยอม (2) เพื่อความปลอดภัย/ป้องกันการละเมิด (3) กฎหมายบังคับ</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">4. การจัดเก็บข้อมูล</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Supabase (PostgreSQL)</strong> — โปรไฟล์, รายการบัญชี, การตั้งค่า</li>
            <li><strong>Google Drive (ของผู้ใช้)</strong> — รูปใบเสร็จและ PDF ที่ระบบสร้าง</li>
            <li><strong>Google Sheets (ของผู้ใช้)</strong> — สำเนารายการแบบ tabular</li>
            <li><strong>Vercel</strong> — โฮสต์ web application (server-side execution)</li>
            <li><strong>Anthropic Claude API</strong> — วิเคราะห์ใบเสร็จ (รูปจะถูกส่งไปประมวลผลเพื่ออ่านยอด, ไม่ถูกเก็บถาวรที่ Anthropic)</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">5. สิทธิ์ของผู้ใช้</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>ขอดูข้อมูลทั้งหมดที่เราเก็บได้</li>
            <li>แก้ไข/ลบรายการได้เองในแอพ</li>
            <li>ขอลบบัญชีและข้อมูลทั้งหมดได้โดยส่งอีเมลถึงเรา</li>
            <li>ยกเลิกการเชื่อมต่อ Google ได้ที่ <a className="text-blue-400 underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a></li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">6. ความปลอดภัย</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>การส่งข้อมูลใช้ HTTPS/TLS ทั้งหมด</li>
            <li>OAuth 2.0 สำหรับการยืนยันตัวตน — เราไม่เก็บรหัสผ่าน Google ของผู้ใช้</li>
            <li>Token เข้ารหัสและเก็บใน database ที่จำกัดสิทธิ์การเข้าถึง</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-8">7. คุกกี้ / Local Storage</h2>
          <p>
            เราใช้ session cookie สำหรับการ login และ localStorage สำหรับเก็บค่าที่ผู้ใช้กรอก
            (เช่น ค่าลดหย่อนภาษี) ไม่มีการใช้ tracking cookie สำหรับโฆษณา
          </p>

          <h2 className="text-lg font-bold text-white mt-8">8. การเปลี่ยนแปลงนโยบาย</h2>
          <p>
            เราอาจปรับปรุงนโยบายนี้เมื่อจำเป็น
            การเปลี่ยนแปลงสำคัญจะแจ้งผู้ใช้ทางอีเมลหรือใน LINE
          </p>

          <h2 className="text-lg font-bold text-white mt-8">9. ติดต่อเรา</h2>
          <p>
            หากมีคำถามเกี่ยวกับ Privacy Policy นี้ ติดต่อได้ที่: <br/>
            <strong>Email:</strong> <a className="text-blue-400 underline" href="mailto:admin@vendeefinance.com">admin@vendeefinance.com</a> <br/>
            <strong>เว็บไซต์:</strong> <a className="text-blue-400 underline" href="https://www.vendeefinance.com">www.vendeefinance.com</a>
          </p>
        </section>

        {/* English Summary for Google verification */}
        <section className="mt-16 pt-10 border-t border-white/10 space-y-4 text-sm leading-relaxed">
          <h2 className="text-lg font-bold text-white">English Summary</h2>
          <p>
            Vendee Finance is a Thai accounting and tax assistant for SME and e-commerce sellers.
            We comply with the <strong>Google API Services User Data Policy</strong>,
            including the Limited Use requirements.
          </p>
          <p><strong>Data we access via Google:</strong></p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><code>drive.file</code> scope — used <strong>only</strong> to create and manage files (PDF receipts, spreadsheets) that the app itself created. We never access the user&apos;s other Drive content.</li>
          </ul>
          <p><strong>What we do with the data:</strong> calculate Thai income tax estimates, sync transactions to user-owned Google Sheets, store receipt PDFs in a user-owned Drive folder.</p>
          <p><strong>What we never do:</strong> sell user data, transfer to third parties for ads, use for ML training, or allow humans to read user data except for security/legal purposes or with explicit user consent.</p>
          <p>To revoke access, visit <a className="text-blue-400 underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>. To request data deletion email <a className="text-blue-400 underline" href="mailto:admin@vendeefinance.com">admin@vendeefinance.com</a>.</p>
        </section>

        <footer className="mt-16 pt-6 border-t border-white/10 text-gray-500 text-xs">
          <p>© {new Date().getFullYear()} Vendee Finance · <Link href="/terms" className="hover:text-gray-300 underline">Terms of Service</Link> · <Link href="/" className="hover:text-gray-300 underline">Home</Link></p>
        </footer>
      </article>
    </main>
  );
}
