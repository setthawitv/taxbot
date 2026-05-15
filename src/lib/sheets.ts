import { google } from "googleapis";
import { ReceiptData } from "./groq";

// ── Thai month tab names ───────────────────────────────────────────────────────
const MONTH_TABS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน",
  "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม",
  "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const ALL_TABS = ["รวม", ...MONTH_TABS];

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

  const sheetDefs = ALL_TABS.map((title) => ({
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

/**
 * Ensure all required tabs (รวม + 12 months) exist on an existing sheet.
 * Called automatically when appendTransaction detects missing tabs.
 */
async function ensureSheetTabs(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<void> {
  // Get existing tab titles
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets.properties.title",
  });
  const existing = new Set(
    meta.data.sheets?.map((s) => s.properties?.title ?? "") ?? []
  );

  const missing = ALL_TABS.filter((t) => !existing.has(t));
  if (missing.length === 0) return;

  // Add missing sheet tabs
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: missing.map((title) => ({
        addSheet: { properties: { title } },
      })),
    },
  });

  // Write headers to each new tab
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: missing.map((title) => ({
        range: `${title}!A1:S1`,
        values: [HEADERS],
      })),
    },
  });
}

// ── Format date as DD/MM/YYYY ─────────────────────────────────────────────────
function formatDateTH(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${parseInt(y, 10)}`;
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
    data.amount,               // O จำนวนหมวดหมู่
    data.expenseCategory,      // P หมวดหมู่ย่อย
    data.vendor,               // Q ผู้รับ/ผู้ให้บริการ
    data.taxId,                // R เลขประจำตัวผู้เสียภาษี
    data.branch,               // S สาขา
  ];
}

/**
 * Append one transaction row to both "รวม" and the relevant month tab.
 * Auto-creates missing tabs for old-format sheets.
 */
export async function appendTransaction(
  accessToken: string,
  sheetId: string,
  data: ReceiptData,
  txId: string
): Promise<void> {
  const auth   = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const row      = buildRow(data, txId);
  const monthTab = MONTH_TABS[parseInt(data.date.split("-")[1], 10) - 1];

  const doAppend = () =>
    Promise.all([
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

  try {
    await doAppend();
  } catch (err: unknown) {
    // Old sheet is missing the new tabs — create them and retry once
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unable to parse range")) {
      console.log("[sheets] missing tabs detected, creating them...");
      await ensureSheetTabs(sheets, sheetId);
      await doAppend();
    } else {
      throw err;
    }
  }
}
