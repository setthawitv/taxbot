import { PDFDocument, rgb, StandardFonts, RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { ReceiptData } from "./groq";

// ─── Thai font (woff via IE User-Agent trick) ─────────────────────────────────
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
function fmt2(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
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

  // Try to embed Thai font; fall back to Helvetica
  let font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  try {
    const fontData = await loadThaiFont();
    if (fontData) {
      font     = await pdfDoc.embedFont(fontData as ArrayBuffer);
      boldFont = font;
    }
  } catch { /* use fallback */ }

  // A4 page
  const page = pdfDoc.addPage([595.28, 841.89]);
  const W = page.getWidth();
  const H = page.getHeight();

  // Colours
  const cBlack  = rgb(0.08, 0.08, 0.08);
  const cGray   = rgb(0.45, 0.45, 0.45);
  const cLight  = rgb(0.93, 0.93, 0.93);
  const cBorder = rgb(0.75, 0.75, 0.75);
  const cBlue   = rgb(0.10, 0.30, 0.70);

  const ML = 50;   // margin left
  const MR = 50;   // margin right
  const CW = W - ML - MR;  // content width

  // ── Outer border ─────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML - 10, y: 35, width: CW + 20, height: H - 65,
    borderColor: cBorder, borderWidth: 1 });

  // ── Header band ──────────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML - 10, y: H - 80, width: CW + 20, height: 45,
    color: rgb(0.15, 0.35, 0.65) });

  const title = "ใบรับรองแทนใบเสร็จรับเงิน";
  const tw    = boldFont.widthOfTextAtSize(title, 18);
  page.drawText(title, { x: (W - tw) / 2, y: H - 62, size: 18, font: boldFont, color: rgb(1,1,1) });

  // ── Sub-header: receipt no + date ────────────────────────────────────────────
  page.drawText(`เลขที่ ${receiptNo}`, { x: ML, y: H - 100, size: 10, font, color: cGray });
  const dateStr  = `วันที่ ${formatDate(receipt.date)}`;
  const dateStrW = font.widthOfTextAtSize(dateStr, 10);
  page.drawText(dateStr, { x: W - MR - dateStrW, y: H - 100, size: 10, font, color: cGray });

  // ── Buyer / seller info box ───────────────────────────────────────────────────
  const infoTop = H - 115;
  page.drawRectangle({ x: ML, y: infoTop - 58, width: CW, height: 62,
    color: rgb(0.97, 0.97, 0.97), borderColor: cBorder, borderWidth: 0.5 });

  function infoRow(label: string, value: string, y: number) {
    page.drawText(label, { x: ML + 8, y, size: 10, font, color: cGray });
    page.drawText(value, { x: ML + 130, y, size: 10, font: boldFont, color: cBlack });
  }

  // Labels depend on transaction type
  const labelPayer    = receipt.type === "expense" ? "ผู้จ่าย / ผู้ซื้อ        :" : "ผู้รับ / เจ้าของกิจการ :";
  const labelReceiver = receipt.type === "expense" ? "ผู้รับ / ผู้ขาย         :" : "ผู้ชำระ / ลูกค้า       :";
  const payerName     = receipt.type === "expense" ? businessName  : receipt.vendor;
  const receiverName  = receipt.type === "expense" ? receipt.vendor : businessName;

  infoRow(labelPayer,              payerName,         infoTop - 16);
  infoRow(labelReceiver,           receiverName,      infoTop - 33);
  infoRow("ประเภทเอกสาร          :", receipt.docType, infoTop - 50);

  // ── Table header ─────────────────────────────────────────────────────────────
  const tableTop   = infoTop - 78;
  const rowH       = 22;
  const col = {
    no:    { x: ML,          w: 30  },
    name:  { x: ML + 30,     w: 220 },
    qty:   { x: ML + 250,    w: 50  },
    unit:  { x: ML + 300,    w: 90  },
    total: { x: ML + 390,    w: CW - 390 },
  };

  // Header row background
  page.drawRectangle({ x: ML, y: tableTop - rowH, width: CW, height: rowH, color: cLight });

  // Header text
  function thCell(text: string, cx: number, cw: number, y: number, bold = false) {
    const tw = (bold ? boldFont : font).widthOfTextAtSize(text, 10);
    page.drawText(text, { x: cx + (cw - tw) / 2, y: y + 6, size: 10,
      font: bold ? boldFont : font, color: cBlack });
  }

  thCell("ลำดับ",            col.no.x,    col.no.w,    tableTop - rowH, true);
  thCell("ชื่อสินค้า / บริการ", col.name.x, col.name.w, tableTop - rowH, true);
  thCell("จำนวน",            col.qty.x,   col.qty.w,   tableTop - rowH, true);
  thCell("ราคาต่อหน่วย",     col.unit.x,  col.unit.w,  tableTop - rowH, true);
  thCell("ราคารวม",          col.total.x, col.total.w, tableTop - rowH, true);

  // Table border lines (header bottom)
  page.drawLine({ start: { x: ML, y: tableTop }, end: { x: ML + CW, y: tableTop },
    thickness: 0.5, color: cBorder });
  page.drawLine({ start: { x: ML, y: tableTop - rowH }, end: { x: ML + CW, y: tableTop - rowH },
    thickness: 1, color: cBlack });

  // ── Data row ─────────────────────────────────────────────────────────────────
  const dataY = tableTop - rowH * 2;

  function cell(text: string, cx: number, cw: number, y: number, align: "left"|"right"|"center" = "center") {
    const tw2 = font.widthOfTextAtSize(text, 10);
    let tx: number;
    if (align === "left")   tx = cx + 6;
    else if (align === "right") tx = cx + cw - tw2 - 6;
    else tx = cx + (cw - tw2) / 2;
    page.drawText(text, { x: tx, y: y + 6, size: 10, font, color: cBlack });
  }

  cell("1",                          col.no.x,    col.no.w,    dataY, "center");
  cell(receipt.description,          col.name.x,  col.name.w,  dataY, "left");
  cell(String(receipt.quantity),     col.qty.x,   col.qty.w,   dataY, "center");
  cell(fmt2(receipt.unitPrice),      col.unit.x,  col.unit.w,  dataY, "right");
  cell(fmt2(receipt.unitPrice * receipt.quantity), col.total.x, col.total.w, dataY, "right");

  // Row bottom border
  page.drawLine({ start: { x: ML, y: dataY }, end: { x: ML + CW, y: dataY },
    thickness: 0.5, color: cBorder });

  // Vertical column dividers (full table height)
  for (const colX of [col.name.x, col.qty.x, col.unit.x, col.total.x, ML + CW]) {
    page.drawLine({
      start: { x: colX, y: tableTop },
      end:   { x: colX, y: dataY },
      thickness: 0.5, color: cBorder,
    });
  }
  page.drawLine({ start: { x: ML, y: tableTop }, end: { x: ML, y: dataY },
    thickness: 0.5, color: cBorder });

  // ── Totals section (right-aligned) ────────────────────────────────────────────
  const totalsX    = ML + CW - 200;
  const totalsW    = 200;
  let   totalsY    = dataY - 10;
  const preTax     = receipt.amount - receipt.vatAmount;

  function totalRow(label: string, value: string, y: number, highlight = false, labelColor?: RGB) {
    page.drawText(label, { x: totalsX, y: y + 5, size: 10, font,
      color: labelColor ?? cGray });
    const vw = boldFont.widthOfTextAtSize(value, 10);
    page.drawText(value, { x: totalsX + totalsW - vw - 4, y: y + 5, size: 10,
      font: highlight ? boldFont : font, color: highlight ? cBlue : cBlack });
  }

  totalRow("ยอดรวมก่อนภาษี",          fmt2(preTax),              totalsY); totalsY -= 18;
  totalRow("ภาษีมูลค่าเพิ่ม 7%",      fmt2(receipt.vatAmount),   totalsY); totalsY -= 18;
  totalRow("ภาษีหัก ณ ที่จ่าย",       fmt2(receipt.withholdingTax), totalsY); totalsY -= 6;

  // Grand total box
  page.drawRectangle({ x: totalsX - 4, y: totalsY - 22, width: totalsW + 8, height: 26,
    color: rgb(0.93, 0.96, 1), borderColor: cBlue, borderWidth: 1 });
  page.drawText("ยอดชำระทั้งสิ้น", { x: totalsX + 2, y: totalsY - 14, size: 11,
    font: boldFont, color: cBlack });
  const grandW = boldFont.widthOfTextAtSize(fmt2(receipt.amount) + " บาท", 12);
  page.drawText(fmt2(receipt.amount) + " บาท", {
    x: totalsX + totalsW - grandW - 4, y: totalsY - 14, size: 12,
    font: boldFont, color: cBlue,
  });

  // ── Declaration note ──────────────────────────────────────────────────────────
  const noteY = totalsY - 48;
  page.drawText(
    "ข้าพเจ้าขอรับรองว่าได้รับชำระเงินตามจำนวนข้างต้นจริง",
    { x: ML, y: noteY, size: 10, font, color: cGray }
  );

  // ── Signature blocks ──────────────────────────────────────────────────────────
  const sigY    = noteY - 60;
  const leftCX  = ML + 80;
  const rightCX = W - MR - 80;

  function sigBlock(label: string, name: string, cx: number) {
    page.drawLine({ start: { x: cx - 70, y: sigY + 30 }, end: { x: cx + 70, y: sigY + 30 },
      thickness: 0.8, color: cBlack });
    const lw = font.widthOfTextAtSize(label, 10);
    page.drawText(label, { x: cx - lw / 2, y: sigY + 16, size: 10, font, color: cGray });
    if (name) {
      const nw = font.widthOfTextAtSize(`(${name})`, 10);
      page.drawText(`(${name})`, { x: cx - nw / 2, y: sigY + 2, size: 10, font, color: cBlack });
    }
    const dw = font.widthOfTextAtSize("วันที่ ____________", 9);
    page.drawText("วันที่ ____________", { x: cx - dw / 2, y: sigY - 13, size: 9, font, color: cGray });
  }

  sigBlock("ผู้จ่ายเงิน / ผู้รับบริการ", businessName, leftCX);
  sigBlock("Confirmed by / ผู้อนุมัติ", "",             rightCX);

  // ── Footer ───────────────────────────────────────────────────────────────────
  page.drawLine({ start: { x: ML - 10, y: 55 }, end: { x: W - MR + 10, y: 55 },
    thickness: 0.5, color: cBorder });
  const footer = "เอกสารนี้ออกโดยระบบ TaxBot • ใช้แทนใบเสร็จในกรณีที่ไม่มีใบเสร็จต้นฉบับ";
  const fw = font.widthOfTextAtSize(footer, 8);
  page.drawText(footer, { x: (W - fw) / 2, y: 43, size: 8, font, color: cGray });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
