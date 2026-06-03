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
      properties: { title: `Vendee Finance - ${businessName}` },
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
      valueInputOption: "RAW",
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

// ── Find 0-based row indices where column B = txId ───────────────────────────
// Does NOT swallow errors — callers handle them.
async function findRowIndicesByTxId(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tabName: string,
  txId: string
): Promise<number[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!B:B`,
  });
  const rows = res.data.values ?? [];
  return rows.reduce<number[]>((acc, row, i) => {
    if (String(row[0] ?? "").trim() === txId.trim()) acc.push(i);
    return acc;
  }, []);
}

// ── Get numeric sheetId (gid) for each tab name ───────────────────────────────
async function getTabGids(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<Map<string, number>> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(title,sheetId))",
  });
  const map = new Map<string, number>();
  for (const s of meta.data.sheets ?? []) {
    const title = s.properties?.title;
    const gid   = s.properties?.sheetId;
    if (title && gid !== undefined && gid !== null) {
      map.set(title, gid);
    }
  }
  return map;
}

// ── Delete rows by 0-based indices (highest-first to avoid index shift) ───────
async function deleteSheetRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetGid: number,
  rowIndices: number[]
): Promise<void> {
  if (rowIndices.length === 0) return;
  const sorted = [...rowIndices].sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: sorted.map((idx) => ({
        deleteDimension: {
          range: {
            sheetId:    sheetGid,
            dimension:  "ROWS",
            startIndex: idx,
            endIndex:   idx + 1,
          },
        },
      })),
    },
  });
}

// ── Derive month tab from DD/MM/YYYY string ───────────────────────────────────
function monthTabFromDDMMYYYY(dateStr: string): string {
  const parts = dateStr.split("/");
  const idx   = parts.length >= 2 ? parseInt(parts[1], 10) - 1 : 0;
  return MONTH_TABS[Math.max(0, Math.min(11, idx))];
}

/**
 * Delete every row with the given txId from "รวม" and ALL month tabs.
 * Searches all tabs in parallel so no guessing of which month tab is needed.
 */
export async function deleteRowByTxId(
  accessToken:   string,
  spreadsheetId: string,
  txId:          string
): Promise<void> {
  const auth   = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const gids = await getTabGids(sheets, spreadsheetId);

  // Search all tabs in parallel
  const searchResults = await Promise.all(
    ALL_TABS.map(async (tabName) => {
      try {
        const indices = await findRowIndicesByTxId(sheets, spreadsheetId, tabName, txId);
        return { tabName, indices };
      } catch {
        return { tabName, indices: [] as number[] };
      }
    })
  );

  // Delete from each tab that has matching rows
  await Promise.all(
    searchResults
      .filter(({ indices }) => indices.length > 0)
      .map(({ tabName, indices }) => {
        const gid = gids.get(tabName);
        if (gid === undefined) return Promise.resolve();
        return deleteSheetRows(sheets, spreadsheetId, gid, indices);
      })
  );
}

/**
 * Update date / description / amount / vendor columns for all rows matching txId
 * in both "รวม" and the relevant month tab.
 */
export async function updateRowByTxId(
  accessToken:   string,
  spreadsheetId: string,
  txId:          string,
  data: { date: string; description: string; amount: number; vendor: string }
): Promise<void> {
  const auth   = getAuth(accessToken);
  const sheets = google.sheets({ version: "v4", auth });

  const newDateFormatted = formatDateTH(data.date);
  const newMonthTab      = MONTH_TABS[parseInt(data.date.split("-")[1], 10) - 1];

  // ── Update in รวม ──────────────────────────────────────────────────────────
  const ruamIndices = await findRowIndicesByTxId(sheets, spreadsheetId, "รวม", txId);
  for (const idx of ruamIndices) {
    const row = idx + 1; // 1-indexed
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `รวม!A${row}`, values: [[newDateFormatted]] },
          { range: `รวม!G${row}`, values: [[data.description]] },
          { range: `รวม!M${row}`, values: [[data.amount]] },
          { range: `รวม!Q${row}`, values: [[data.vendor]] },
        ],
      },
    });
  }

  // ── Update in month tab (search the new month tab; also old month if different) ─
  const monthIndices = await findRowIndicesByTxId(sheets, spreadsheetId, newMonthTab, txId);
  for (const idx of monthIndices) {
    const row = idx + 1;
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          { range: `${newMonthTab}!A${row}`, values: [[newDateFormatted]] },
          { range: `${newMonthTab}!G${row}`, values: [[data.description]] },
          { range: `${newMonthTab}!M${row}`, values: [[data.amount]] },
          { range: `${newMonthTab}!Q${row}`, values: [[data.vendor]] },
        ],
      },
    });
  }

  // If row wasn't found in the new month tab, search all other month tabs
  // (handles the case where the user changed the transaction's month)
  if (monthIndices.length === 0) {
    for (const tabName of MONTH_TABS) {
      if (tabName === newMonthTab) continue;
      const otherIndices = await findRowIndicesByTxId(sheets, spreadsheetId, tabName, txId);
      if (otherIndices.length === 0) continue;
      for (const idx of otherIndices) {
        const row = idx + 1;
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "RAW",
            data: [
              { range: `${tabName}!A${row}`, values: [[newDateFormatted]] },
              { range: `${tabName}!G${row}`, values: [[data.description]] },
              { range: `${tabName}!M${row}`, values: [[data.amount]] },
              { range: `${tabName}!Q${row}`, values: [[data.vendor]] },
            ],
          },
        });
      }
      break; // found and updated — stop searching
    }
  }
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
        valueInputOption: "RAW",
        requestBody: { values: [row] },
      }),
      sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${monthTab}!A:S`,
        valueInputOption: "RAW",
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
