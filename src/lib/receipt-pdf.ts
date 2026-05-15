import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ReceiptData } from "./gemini";

// ─── Thai font (reuse the woff-via-IE-UA trick) ───────────────────────────────
async function loadThaiFont(): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      "https://fonts.googleapis.com/css?family=Sarabun:400,700&subset=thai",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)",
        },
      }
    ).then((r) => r.text());

    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/);
    if (!match) return null;

    return fetch(match[1]).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAmount(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท";
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  const months = [
    "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
    "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
    "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10)]} ${parseInt(y, 10) + 543}`;
}

// ─── Main generator ──────────────────────────────────────────────────────────
export async function generateReceiptPdf(
  receipt: ReceiptData,
  businessName: string,
  receiptNo: string
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Try to embed Thai font; fall back to built-in Helvetica
  let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  try {
    const fontData = await loadThaiFont();
    if (fontData) {
      font = await pdfDoc.embedFont(fontData as ArrayBuffer);
      boldFont = font; // same font file contains both
    }
  } catch { /* use fallback */ }

  // A4 page
  const page = pdfDoc.addPage([595.28, 841.89]);
  const W = page.getWidth();

  const dark   = rgb(0.1, 0.1, 0.1);
  const gray   = rgb(0.5, 0.5, 0.5);
  const border = rgb(0.8, 0.8, 0.8);

  // ── Border ─────────────────────────────────────────────────────────────────
  page.drawRectangle({
    x: 40, y: 40, width: W - 80, height: 762,
    borderColor: border, borderWidth: 1,
  });

  // ── Title ──────────────────────────────────────────────────────────────────
  const title = "ใบรับรองแทนใบเสร็จรับเงิน";
  const titleSize = 20;
  const titleW = boldFont.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (W - titleW) / 2, y: 755, size: titleSize, font: boldFont, color: dark,
  });

  // Underline
  page.drawLine({
    start: { x: (W - titleW) / 2 - 4, y: 750 },
    end:   { x: (W - titleW) / 2 + titleW + 4, y: 750 },
    thickness: 1.5, color: dark,
  });

  // ── Ref / Date row ─────────────────────────────────────────────────────────
  page.drawText(`เลขที่: ${receiptNo}`, {
    x: 60, y: 720, size: 11, font, color: gray,
  });
  page.drawText(`วันที่: ${formatDate(receipt.date)}`, {
    x: W - 200, y: 720, size: 11, font, color: gray,
  });

  // ── Horizontal rule ────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 60, y: 710 }, end: { x: W - 60, y: 710 },
    thickness: 0.5, color: border,
  });

  // ── Info rows ──────────────────────────────────────────────────────────────
  function drawRow(label: string, value: string, y: number, valueIsBold = false) {
    page.drawText(label, { x: 60, y, size: 12, font, color: gray });
    page.drawText(value, {
      x: 220, y, size: 12, font: valueIsBold ? boldFont : font, color: dark,
    });
  }

  drawRow("ผู้ซื้อ / ผู้รับบริการ:", businessName, 685);
  drawRow("ร้านค้า / ผู้จ่าย:", receipt.vendor, 658);
  drawRow("รายละเอียด:", receipt.description, 631);
  drawRow("ประเภท:", receipt.type === "income" ? "รายรับ" : "รายจ่าย", 604);

  // ── Amount box ─────────────────────────────────────────────────────────────
  page.drawRectangle({
    x: 55, y: 560, width: W - 110, height: 34,
    color: rgb(0.95, 0.97, 1), borderColor: rgb(0.6, 0.7, 0.9), borderWidth: 1,
  });
  const amountLabel = "จำนวนเงินรวมทั้งสิ้น";
  const amountValue = formatAmount(receipt.amount);
  page.drawText(amountLabel, { x: 70, y: 572, size: 13, font: boldFont, color: dark });
  const valW = boldFont.widthOfTextAtSize(amountValue, 16);
  page.drawText(amountValue, {
    x: W - 60 - valW, y: 569, size: 16, font: boldFont, color: rgb(0.1, 0.3, 0.7),
  });

  // ── Horizontal rule ────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 60, y: 545 }, end: { x: W - 60, y: 545 },
    thickness: 0.5, color: border,
  });

  // ── Signature section ──────────────────────────────────────────────────────
  function sigBlock(label: string, name: string, x: number, y: number) {
    // Signature line
    page.drawLine({
      start: { x: x - 60, y: y + 30 }, end: { x: x + 60, y: y + 30 },
      thickness: 0.8, color: dark,
    });
    // Label
    const lw = font.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: x - lw / 2, y: y + 15, size: 10, font, color: gray });
    // Name
    if (name) {
      const nw = font.widthOfTextAtSize(`(${name})`, 10);
      page.drawText(`(${name})`, { x: x - nw / 2, y: y, size: 10, font, color: dark });
    }
  }

  sigBlock("ผู้รับรอง", businessName, 155, 490);
  sigBlock("ผู้อนุมัติ", "", 440, 490);

  // ── Footer note ────────────────────────────────────────────────────────────
  page.drawLine({
    start: { x: 60, y: 90 }, end: { x: W - 60, y: 90 },
    thickness: 0.5, color: border,
  });
  const note = "เอกสารนี้ออกโดย TaxBot — ใช้แทนใบเสร็จในกรณีที่ไม่มีใบเสร็จต้นฉบับ";
  const noteW = font.widthOfTextAtSize(note, 9);
  page.drawText(note, {
    x: (W - noteW) / 2, y: 75, size: 9, font, color: gray,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
