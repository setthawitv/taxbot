import { google } from "googleapis";
import { ReceiptData } from "./groq";

// ── Thai month tab names ───────────────────────────────────────────────────────
const MONTH_TABS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

// ── 19 columns A–S ────────────────────────────────────────────────────────────
const HEADERS = [
  "วันที่",                    // A
  "ไอดี",                     // B
  "เลขที่ใบกำกับภาษี",         // C
  "ประเภทเอกสาร",              // D
  "สถานะการจ่ายเงิน",          // E
  "ใบกำกับภาษีชื่อ",           // F
  "รายละเอียด",                // G
  "จำนวน",                    // H
  "ราคาต่อหน่วย",              // I
  "ยอดรวมก่อนภาษี",            // J
  "ภาษีมูลค่าเพิ่ม",           // K
  "ภาษีที่ ณ ที่จ่าย",         // L
  "ยอดชำระ",                  // M
  "ประเภทค่าใช้จ่าย",          // N
  "จำนวนหมวดหมู่",             // O
  "หมวดหมู่ย่อย",              // P
  "ผู้รับ/ผู้ให้บริการ",        // Q
  "เลขประจำตัวผู้เสียภาษี",    // R
  "สาขา",                     // S
];

function getAuth(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return auth;
}

function headerRow() {
  return [{ values: HEADERS.map((h) => ({ userEnteredValue: { stringValue: h } })) }];
}

// ── Create new Google Sheet with รวม + 12 monthly tabs ───────────────────────
export async function createSheet(accessToken: string, businessName: string): Promise<string> {
  const auth   = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  // Build sheet tabs: รวม first, then each month
  const sheetDefs = ["รวม", ...MONTH_TABS].map((title) => ({
    properties: { title },
    data: [{ startRow: 0, rowData: headerRow() }],
  }));

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: `TaxBot - ${businessName}` },
      sheets: sheetDefs,
    },
  });

  return response.data.spreadsheetId!;
}

// ── Format date as DD/MM/YYYY (Thai) ─────────────────────────────────────────
function formatDateTH(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${parseInt(y, 10)}`;   // keep CE year to match screenshot
}

// ── Build a 19-value row array ────────────────────────────────────────────────
function buildRow(data: ReceiptData, txId: string): (string | number)[] {
  const preTax = data.amount - data.vatAmount;
  return [
    formatDateTH(data.date),   // A วันที่
    txId,                      // B ไอดี
    data.invoiceNo,            // C เลขที่ใบกำกับภาษี
    data.docType,              // D ประเภทเอกสาร
    "จ่ายแล้ว",                // E สถานะการจ่ายเงิน
    data.invoiceName,          // F ใบกำกับภาษีชื่อ
    data.description,          // G รายละเอียด
    data.quantity,             // H จำนวน
    data.unitPrice,            // I ราคาต่อหน่วย
    preTax,                    // J ยอดรวมก่อนภาษี
    data.vatAmount,            // K ภาษีมูลค่าเพิ่ม
    data.withholdingTax,       // L ภาษีที่ ณ ที่จ่าย
    data.amount,               // M ยอดชำระ
    data.expenseCategory,      // N ประเภทค่าใช้จ่าย
    data.amount,               // O จำนวนหมวดหมู่ (same amount per category)
    data.expenseCategory,      // P หมวดหมู่ย่อย
    data.vendor,               // Q ผู้รับ/ผู้ให้บริการ
    data.taxId,                // R เลขประจำตัวผู้เสียภาษี
    data.branch,               // S สาขา
  ];
}

/**
 * Append one transaction row to both the "รวม" tab and the relevant month tab.
 * txId must be provided (generate on the caller side).
 */
export async function appendTransaction(
  accessToken: string,
  sheetId: string,
  data: ReceiptData,
  txId: string
): Promise<void> {
  const auth   = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const row        = buildRow(data, txId);
  const monthIndex = parseInt(data.date.split("-")[1], 10) - 1;  // 0-based
  const monthTab   = MONTH_TABS[monthIndex];

  // Append to both tabs simultaneously
  await Promise.all([
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "รวม!A:S",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    }),
    sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${monthTab}!A:S`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    }),
  ]);
}
