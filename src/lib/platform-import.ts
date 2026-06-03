/**
 * Parses order export files from TikTok Shop, Shopee, and Lazada
 * into a normalised list of income transactions.
 */

export type ImportedRow = {
  lineKey:     string;  // unique key = orderId_skuLineId (or orderId for single-SKU)
  orderId:     string;  // raw Order ID from platform
  skuLineId:   string;  // SKU line item ID (empty string if not available)
  date:        string;  // YYYY-MM-DD
  amount:      number;
  platform:    "tiktok" | "shopee" | "lazada";
  productName: string;
  variant:     string;  // size/colour variant
};

export type PreviewItem = {
  orderId:     string;
  date:        string;
  amount:      number;
  description: string;
};

export type ParseResult = {
  rows:      ImportedRow[];
  cancelled: number;   // cancelled orders
  returned:  number;   // returned / refunded orders
  skipped:   number;   // cancelled + returned (for backward compat)
  total:     number;   // sum of amount
  platform:  "tiktok" | "shopee" | "lazada";
  // summary-mode only (TikTok report / Shopee summary)
  periodStart?:  string;        // YYYY-MM-DD
  periodEnd?:    string;        // YYYY-MM-DD
  orderCount?:   number;        // successful order count from detail sheet
  previewItems?: PreviewItem[]; // individual rows for preview display
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseThaiDate(raw: string): string {
  const s = String(raw ?? "").trim();
  // TikTok Income Report: "2025/11/14" → 2025-11-14
  const mISO = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (mISO) return `${mISO[1]}-${mISO[2].padStart(2, "0")}-${mISO[3].padStart(2, "0")}`;
  // TikTok Order Report: "27/04/2026 20:56:55" → 2026-04-27
  const m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseISODate(raw: string): string {
  // Shopee / Lazada: "2026-04-27 20:56:55"
  const m = String(raw ?? "").trim().match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

// ─── TikTok ───────────────────────────────────────────────────────────────────
// Supports two TikTok export formats:
//
// A) Income Report (รายงานรายรับ) — filename: income_*.xlsx
//    Thai headers: หมายเลขคำสั่งซื้อ/การปรับ, ประเภทธุรกรรม, เวลาที่ชำระคำสั่งซื้อ, รายได้รวม, ...
//    Income = รายได้รวม (ค่าสินค้า + ค่าส่งที่ลูกค้าจ่าย)
//
// B) Order Report — English headers: Order ID, Order Status, SKU ID, Seller Revenue, ...
//    Income = per-item Seller Revenue
export function parseTikTok(rows: string[][], detailRows?: string[][]): ParseResult {
  const header = rows[0].map((h) => String(h ?? "").trim());

  // รายงาน sheet: all headers are empty strings (summary layout)
  const isReportSheet = header.every((h) => h === "") && rows.length > 5;
  if (isReportSheet) {
    return parseTikTokReportSheet(rows, detailRows);
  }

  // รายละเอียดคำสั่งซื้อ sheet with Thai headers
  const isIncomeReport = header.some((h) => h.includes("หมายเลขคำสั่งซื้อ/การปรับ") || h === "รายได้รวม");
  if (isIncomeReport) {
    return parseTikTokIncomeReport(rows, header);
  }
  return parseTikTokOrderReport(rows, header);
}

// ── Format A: TikTok Income Report ───────────────────────────────────────────
function parseTikTokIncomeReport(rows: string[][], header: string[]): ParseResult {
  const idx = (name: string) => header.findIndex((h) => h.includes(name));

  const iOrderId  = idx("หมายเลขคำสั่งซื้อ");  // หมายเลขคำสั่งซื้อ/การปรับ
  const iType     = idx("ประเภทธุรกรรม");
  const iDate     = idx("เวลาที่ชำระคำสั่งซื้อ");
  const iIncome   = idx("รายได้รวม");            // ค่าสินค้า + ค่าส่งลูกค้า

  console.log("[TikTok income] column map:", { iOrderId, iType, iDate, iIncome, totalCols: header.length });

  const seen = new Set<string>();
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 4) continue;

    const orderId = String(r[iOrderId] ?? "").trim();
    if (!orderId) continue;

    const txType = String(r[iType] ?? "").trim();

    // Skip refunds and adjustments — only "คำสั่งซื้อ" (order) rows
    if (txType.includes("คืน") || txType.includes("Refund") || txType.includes("Return")) {
      returned++; continue;
    }
    if (txType.includes("ยกเลิก") || txType.includes("Cancel")) {
      cancelled++; continue;
    }

    if (seen.has(orderId)) continue;
    seen.add(orderId);

    const income = parseFloat(String(iIncome >= 0 ? r[iIncome] : "0").replace(/,/g, "").trim() || "0");
    if (income <= 0) { cancelled++; continue; }

    const date = parseThaiDate(String(iDate >= 0 ? r[iDate] : "").trim());

    result.push({
      lineKey:     `tiktok_income_${orderId}`,
      orderId,
      skuLineId:   "",
      date,
      amount:      Math.round(income * 100) / 100,
      platform:    "tiktok",
      productName: "TikTok Shop",
      variant:     "",
    });
  }

  return {
    rows:      result,
    cancelled,
    returned,
    skipped:   cancelled + returned,
    total:     result.reduce((s, r) => s + r.amount, 0),
    platform:  "tiktok",
  };
}

// ── Format C: TikTok รายงาน sheet (period summary) ───────────────────────────
// Layout: label in cols 1-4, value always in col 5
// Formula (per TikTok tax guidance):
//   รายได้ = ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย
//           + ยอดรวมเงินคืนหลังหักส่วนลดจากร้านค้า  (negative)
//           + ค่าธรรมเนียมการจัดส่งของลูกค้า
function parseTikTokReportSheet(rows: string[][], detailRows?: string[][]): ParseResult {
  // Build label → value map (value is always col 5)
  const valMap = new Map<string, number>();
  let periodStr = "";

  for (const row of rows) {
    const label = row.slice(1, 5).map((c) => String(c ?? "").trim()).find((c) => c !== "") ?? "";
    const rawVal = String(row[5] ?? "").trim();
    if (label === "ช่วงเวลา") { periodStr = rawVal; continue; }
    if (label && rawVal !== "") {
      valMap.set(label, parseFloat(rawVal.replace(/,/g, "") || "0"));
    }
  }

  const productNet = valMap.get("ยอดรวมค่าสินค้าหลังหักส่วนลดจากผู้ขาย") ?? 0;
  const refund     = valMap.get("ยอดรวมเงินคืนหลังหักส่วนลดจากร้านค้า")   ?? 0; // negative
  const shipping   = valMap.get("ค่าธรรมเนียมการจัดส่งของลูกค้า")           ?? 0;
  const income     = Math.round((productNet + refund + shipping) * 100) / 100;

  console.log("[TikTok report] productNet:", productNet, "refund:", refund, "shipping:", shipping, "income:", income);

  if (income <= 0) {
    return { rows: [], cancelled: 0, returned: 0, skipped: 0, total: 0, platform: "tiktok" };
  }

  // Parse period dates from "2025/10/01-2025/12/01"
  const [startRaw, endRaw] = periodStr.split("-");
  const periodStart = parseThaiDate(startRaw?.trim() ?? "");
  const periodEnd   = parseThaiDate(endRaw?.trim() ?? "");
  const lineKey = `tiktok_report_${periodStr.replace(/\//g, "").replace("-", "_")}`;

  // Count + preview rows from detail sheet (รายละเอียดคำสั่งซื้อ)
  let orderCount = 0;
  let returnCount = 0;
  let cancelCount = 0;
  const previewItems: PreviewItem[] = [];

  if (detailRows && detailRows.length > 1) {
    const dHeader = detailRows[0].map((h) => String(h ?? "").trim());
    const iType    = dHeader.findIndex((h) => h.includes("ประเภทธุรกรรม"));
    const iOrderId = dHeader.findIndex((h) => h.includes("หมายเลขคำสั่งซื้อ"));
    const iDate    = dHeader.findIndex((h) => h.includes("เวลาที่ชำระคำสั่งซื้อ"));
    const iIncome  = dHeader.findIndex((h) => h === "รายได้รวม");

    for (let i = 1; i < detailRows.length; i++) {
      const r = detailRows[i];
      const txType = String(r[iType] ?? "").trim();
      if (!txType) continue;
      if (txType.includes("คืน") || txType.includes("Refund") || txType.includes("Return")) { returnCount++; continue; }
      if (txType.includes("ยกเลิก") || txType.includes("Cancel")) { cancelCount++; continue; }
      orderCount++;
      const amt = parseFloat(String(iIncome >= 0 ? r[iIncome] : "0").replace(/,/g, "") || "0");
      if (previewItems.length < 10) {
        previewItems.push({
          orderId:     String(r[iOrderId] ?? "").trim(),
          date:        parseThaiDate(String(iDate >= 0 ? r[iDate] : "").trim()),
          amount:      amt,
          description: "TikTok Shop",
        });
      }
    }
  }

  return {
    rows: [{
      lineKey,
      orderId:     lineKey,
      skuLineId:   "",
      date:        periodEnd || new Date().toISOString().slice(0, 10),
      amount:      income,
      platform:    "tiktok",
      productName: `TikTok Shop รายงาน ${periodStr}`,
      variant:     "",
    }],
    cancelled:    cancelCount,
    returned:     returnCount,
    skipped:      cancelCount + returnCount,
    total:        income,
    platform:     "tiktok",
    periodStart,
    periodEnd,
    orderCount:   orderCount || undefined,
    previewItems: previewItems.length > 0 ? previewItems : undefined,
  };
}

// ── Format B: TikTok Order Report ─────────────────────────────────────────────
// Unique key = Order ID + SKU ID (line-item level)
function parseTikTokOrderReport(rows: string[][], header: string[]): ParseResult {
  const idx  = (name: string) => header.findIndex((h) => h === name);
  const idxAny = (...names: string[]) =>
    names.reduce<number>((found, n) => (found >= 0 ? found : idx(n)), -1);

  const iOrderId  = idx("Order ID");
  const iStatus   = idx("Order Status");
  const iSkuId    = idxAny("SKU ID", "Order Line Item ID", "Line Item ID", "SKU Line Item ID");
  const iRevenue  = idxAny(
    "Seller Revenue", "Net Amount", "Settlement Amount",
    "SKU Subtotal After Discount", "Subtotal After Discount",
    "ยอดรายได้ผู้ขาย", "ยอดสุทธิ",
  );
  const iUnitPrice = idxAny("SKU Unit Original Price", "Original Price", "Unit Price", "Price", "ราคาต่อหน่วย");
  const iDiscount  = idxAny("TikTok Shop Discount", "Seller Discount", "Platform Discount", "Discount", "ส่วนลด");
  const iPaidTime = idx("Paid Time");
  const iProduct  = idx("Product Name");
  const iVariant  = idxAny("Variation", "SKU Variation", "Variation Name", "SKU Name");

  console.log("[TikTok order] column map:", {
    iOrderId, iStatus, iSkuId, iRevenue, iUnitPrice, iDiscount, iPaidTime, iProduct, iVariant,
    totalCols: header.length,
  });

  const seen = new Set<string>();
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;

    const orderId = r[iOrderId]?.trim();
    const status  = r[iStatus]?.trim() ?? "";
    if (!orderId) continue;

    if (status.includes("ยกเลิก") || status.includes("Cancel")) { cancelled++; continue; }
    if (status.includes("Return") || status.includes("คืน") || status.includes("Refund")) { returned++; continue; }

    const skuId   = iSkuId >= 0 ? (r[iSkuId]?.trim() || "") : "";
    const lineKey = skuId ? `${orderId}_${skuId}` : orderId;

    if (seen.has(lineKey)) continue;
    seen.add(lineKey);

    let net = 0;
    if (iRevenue >= 0) {
      net = parseFloat(r[iRevenue]?.trim() || "0");
    } else if (iUnitPrice >= 0 && iDiscount >= 0) {
      net = parseFloat(r[iUnitPrice]?.trim() || "0") - parseFloat(r[iDiscount]?.trim() || "0");
    } else {
      net = parseFloat(r[15]?.trim() || "0");
    }

    if (net <= 0) { cancelled++; continue; }

    const date        = parseThaiDate(r[iPaidTime] ?? "");
    const productName = (r[iProduct]?.trim() || "TikTok Shop").slice(0, 200);
    const variant     = (iVariant >= 0 ? r[iVariant]?.trim() : "") || "";

    result.push({
      lineKey,
      orderId,
      skuLineId:   skuId,
      date,
      amount:      net,
      platform:    "tiktok",
      productName,
      variant:     variant.slice(0, 100),
    });
  }

  return {
    rows:      result,
    cancelled,
    returned,
    skipped:   cancelled + returned,
    total:     result.reduce((s, r) => s + r.amount, 0),
    platform:  "tiktok",
  };
}

// ─── Shopee ───────────────────────────────────────────────────────────────────
// Supports two Shopee export formats:
//
// A) Income/Payout Report ("รายงานรายรับ" / "Income.โอนเงินสำเร็จ")
//    - Multi-sheet XLSX with "Income" sheet
//    - Metadata rows 1-5, headers on row 6
//    - Key columns: หมายเลขคำสั่งซื้อ, วันที่โอนชำระเงินสำเร็จ, จำนวนเงินทั้งหมดที่โอนแล้ว (฿)
//    - All rows = successful transfers (no status filtering needed)
//
// B) Order Report (older format)
//    - Headers on row 1, has สถานะการสั่งซื้อ, ราคาขายสุทธิ, etc.
//
export function parseShopee(rows: string[][]): ParseResult {
  // ── Find header row (scan first 10 rows for หมายเลขคำสั่งซื้อ) ──────────────
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    if (rows[i].some((cell) => String(cell ?? "").includes("หมายเลขคำสั่งซื้อ"))) {
      headerRowIdx = i;
      break;
    }
  }

  const header = rows[headerRowIdx].map((h) => String(h ?? "").trim());
  const find = (...candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h.includes(c)));

  const iOrderId = find("หมายเลขคำสั่งซื้อ", "Order ID", "เลขที่คำสั่งซื้อ");

  // ── Detect: Income/Payout report vs Order report ───────────────────────────
  const isIncomeReport = find("จำนวนเงินทั้งหมดที่โอนแล้ว") >= 0;

  console.log("[Shopee parser] headerRow:", headerRowIdx, "isIncomeReport:", isIncomeReport);

  // ════════════════════════════════════════════════════════════════════════════
  // FORMAT A — Income/Payout Report
  // ════════════════════════════════════════════════════════════════════════════
  if (isIncomeReport) {
    // Tax formula (per Shopee University):
    // รายได้ = สินค้าราคาปกติ (A)
    //        − ส่วนลดสินค้าจากผู้ขาย (B1)
    //        − โค้ดส่วนลดที่ออกโดยผู้ขาย (B2)
    //        − โค้ดส่วนลดร่วมที่ออกโดยผู้ขาย
    //        − จำนวนเงินที่คืนให้ผู้ซื้อ
    //        + ค่าจัดส่งที่ชำระโดยผู้ซื้อ (C)
    // (columns B1, B2, refund are already negative values in the file)
    const iDate     = find("วันที่โอนชำระเงินสำเร็จ");
    const iListPrice = find("สินค้าราคาปกติ");                    // A
    const iSellerDisc = find("ส่วนลดสินค้าจากผู้ขาย");           // B1 (negative)
    const iVoucherDisc = find("โค้ดส่วนลดที่ออกโดยผู้ขาย");     // B2 (negative)
    const iCoVoucherDisc = find("โค้ดส่วนลดร่วมที่ออกโดยผู้ขาย"); // (negative)
    const iRefund   = find("จำนวนเงินที่ทำการคืนให้ผู้ซื้อ");    // (negative)
    const iBuyerShip = find("ค่าจัดส่งที่ชำระโดยผู้ซื้อ");       // C (positive)

    console.log("[Shopee income] cols:", {
      iOrderId, iDate, iListPrice, iSellerDisc, iVoucherDisc, iCoVoucherDisc, iRefund, iBuyerShip,
    });

    function col(r: string[], i: number): number {
      if (i < 0) return 0;
      return parseFloat(String(r[i] ?? "0").replace(/,/g, "").trim() || "0");
    }

    const seen   = new Set<string>();
    const result: ImportedRow[] = [];
    let skipped  = 0;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (r.length < 3) continue;

      const orderId = (iOrderId >= 0 ? r[iOrderId] : "")?.trim();
      if (!orderId) continue;

      if (seen.has(orderId)) continue;
      seen.add(orderId);

      // รายได้ = A + B1 + B2 + co-voucher + refund + C
      // (B1, B2, refund stored as negative → naturally subtracted)
      const amount =
        col(r, iListPrice)     +   // A  (+)
        col(r, iSellerDisc)    +   // B1 (-)
        col(r, iVoucherDisc)   +   // B2 (-)
        col(r, iCoVoucherDisc) +   // co-funded voucher (-)
        col(r, iRefund)        +   // refund (-)
        col(r, iBuyerShip);        // C  (+)

      // Negative or zero = full refund order, skip
      if (amount <= 0) { skipped++; continue; }

      const date = parseISODate(String(iDate >= 0 ? r[iDate] : "").trim());

      result.push({
        lineKey:     `shopee_income_${orderId}`,
        orderId,
        skuLineId:   "",
        date,
        amount:      Math.round(amount * 100) / 100,
        platform:    "shopee",
        productName: "Shopee",
        variant:     "",
      });
    }

    return {
      rows:      result,
      cancelled: 0,
      returned:  skipped,
      skipped,
      total:     result.reduce((s, r) => s + r.amount, 0),
      platform:  "shopee",
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FORMAT B — Order Report (original format)
  // ════════════════════════════════════════════════════════════════════════════
  const iStatus   = find("สถานะการสั่งซื้อ", "Order Status", "สถานะ");
  const iReturn   = find("สถานะการคืนเงินหรือคืนสินค้า", "สถานะการคืน");
  const iDate     = find("วันที่ทำการสั่งซื้อ", "Order Creation Date", "วันที่สร้าง");
  const iProduct  = find("ชื่อสินค้า", "Product Name", "Item Name");
  const iSkuRef   = find("เลขอ้างอิง SKU", "SKU Reference", "SKU Ref");
  const iVariant  = find("ชื่อตัวเลือก", "Variation", "SKU Variation");
  const iNetPrice = find("ราคาขายสุทธิ", "Net Price", "Seller Net Price");
  const iQty      = find("จำนวน", "Quantity", "Qty");

  console.log("[Shopee order] columns:", {
    iOrderId, iStatus, iReturn, iDate, iProduct, iSkuRef, iVariant, iNetPrice, iQty,
  });

  const seen       = new Set<string>();
  const orderCount = new Map<string, number>();
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;

    const orderId = (iOrderId >= 0 ? r[iOrderId] : "")?.trim();
    if (!orderId) continue;

    const status       = (iStatus >= 0 ? r[iStatus] : "")?.trim() ?? "";
    const returnStatus = (iReturn >= 0 ? r[iReturn] : "")?.trim() ?? "";

    if (status.includes("ยกเลิก") || status.includes("Cancel")) {
      cancelled++; continue;
    }
    if (
      returnStatus !== "" && returnStatus !== "-" &&
      (returnStatus.includes("คืน") || returnStatus.includes("Return") ||
       returnStatus.includes("Refund") || returnStatus.includes("ยอมรับ") ||
       returnStatus.includes("Accepted") || returnStatus.includes("accepted"))
    ) {
      returned++; continue;
    }

    const skuRef = (iSkuRef >= 0 ? r[iSkuRef] : "")?.trim() || "";
    const seq    = (orderCount.get(orderId) ?? 0) + 1;
    orderCount.set(orderId, seq);
    const lineKey = skuRef ? `${orderId}_${skuRef}` : `${orderId}_${seq}`;

    if (seen.has(lineKey)) continue;
    seen.add(lineKey);

    const netPrice = parseFloat((iNetPrice >= 0 ? r[iNetPrice] : "0")?.replace(/,/g, "").trim() || "0");
    const qty      = parseFloat((iQty      >= 0 ? r[iQty]      : "1")?.replace(/,/g, "").trim() || "1");
    const amount   = netPrice * (qty || 1);

    if (amount <= 0) { cancelled++; continue; }

    const date        = parseISODate((iDate    >= 0 ? r[iDate]    : "")?.trim() || "");
    const productName = ((iProduct >= 0 ? r[iProduct] : "")?.trim() || "Shopee").slice(0, 200);
    const variant     = ((iVariant >= 0 ? r[iVariant] : "")?.trim() || "").slice(0, 100);

    result.push({
      lineKey,
      orderId,
      skuLineId:   skuRef,
      date,
      amount,
      platform:    "shopee",
      productName,
      variant,
    });
  }

  return {
    rows:      result,
    cancelled,
    returned,
    skipped:   cancelled + returned,
    total:     result.reduce((s, r) => s + r.amount, 0),
    platform:  "shopee",
  };
}

// ── Shopee Summary Report ─────────────────────────────────────────────────────
// File has 3 sheets: Summary (totals), Income (individual orders), Service Fee Details
// Income formula: "1. รายได้ทั้งหมด" + "ค่าจัดส่งที่ชำระโดยผู้ซื้อ" (from Summary sheet)
// Individual rows: from Income sheet for preview display
export function parseShopeeSummaryReport(summaryRows: string[][], incomeRows: string[][]): ParseResult {
  // Build map: label → value for Summary sheet
  // Summary structure: col0 or col1 = label, col2 or col3 = value
  let productIncome = 0;
  let customerShipping = 0;
  let startDate = "";
  let endDate   = "";

  for (const row of summaryRows) {
    const c0 = String(row[0] ?? "").trim();
    const c1 = String(row[1] ?? "").trim();
    const v2 = parseFloat(String(row[2] ?? "").toString().replace(/,/g, "") || "0");
    const v3 = parseFloat(String(row[3] ?? "").toString().replace(/,/g, "") || "0");

    if (c0 === "จาก") { startDate = String(row[1] ?? "").trim(); continue; }
    if (c0 === "ถึง")  { endDate   = String(row[1] ?? "").trim(); continue; }
    if (c0.includes("1. รายได้ทั้งหมด")) { productIncome = v3; continue; }
    if (c1 === "ค่าจัดส่งที่ชำระโดยผู้ซื้อ") { customerShipping = v2; continue; }
  }

  const income = Math.round((productIncome + customerShipping) * 100) / 100;
  console.log("[Shopee summary] productIncome:", productIncome, "shipping:", customerShipping, "income:", income);

  if (income <= 0) {
    return { rows: [], cancelled: 0, returned: 0, skipped: 0, total: 0, platform: "shopee" };
  }

  const periodStart = startDate ? parseISODate(startDate) : "";
  const periodEnd   = endDate   ? parseISODate(endDate)   : "";
  const periodStr   = `${startDate}_${endDate}`.replace(/-/g, "");
  const lineKey     = `shopee_summary_${periodStr}`;

  // Count + preview rows from Income sheet
  // Income headers at row 5, data from row 6
  let orderCount  = 0;
  let returnCount = 0;
  const previewItems: PreviewItem[] = [];

  if (incomeRows.length > 6) {
    const h = incomeRows[5].map((c) => String(c ?? "").trim());
    const iOrderId = h.indexOf("หมายเลขคำสั่งซื้อ");          // col 1
    const iReturn  = h.indexOf("รหัสคืนสินค้า");               // col 2 — empty = order, non-empty = return
    const iDate    = h.indexOf("วันที่โอนชำระเงินสำเร็จ");     // col 10
    const iPayout  = h.findIndex((c) => c.includes("จำนวนเงินทั้งหมดที่โอนแล้ว")); // col 36

    for (let i = 6; i < incomeRows.length; i++) {
      const r = incomeRows[i];
      if (!r[iOrderId]) continue;
      const isReturn = String(r[iReturn] ?? "").trim() !== "";
      if (isReturn) { returnCount++; continue; }
      orderCount++;
      const payout = parseFloat(String(iPayout >= 0 ? r[iPayout] : "0").toString().replace(/,/g, "") || "0");
      if (previewItems.length < 10) {
        previewItems.push({
          orderId:     String(r[iOrderId] ?? "").trim(),
          date:        parseISODate(String(iDate >= 0 ? r[iDate] : "").trim()),
          amount:      payout,
          description: "Shopee",
        });
      }
    }
  }

  return {
    rows: [{
      lineKey,
      orderId:     lineKey,
      skuLineId:   "",
      date:        periodEnd || new Date().toISOString().slice(0, 10),
      amount:      income,
      platform:    "shopee",
      productName: `Shopee รายงาน ${startDate} - ${endDate}`,
      variant:     "",
    }],
    cancelled:    0,
    returned:     returnCount,
    skipped:      returnCount,
    total:        income,
    platform:     "shopee",
    periodStart,
    periodEnd,
    orderCount:   orderCount || undefined,
    previewItems: previewItems.length > 0 ? previewItems : undefined,
  };
}

// ─── Lazada ───────────────────────────────────────────────────────────────────
// Lazada order report typical columns:
//  "Order Number", "Status", "Paid Price", "Created at", "Item Name"
export function parseLazada(rows: string[][]): ParseResult {
  const header = rows[0].map((h) => h.trim());
  const find = (...candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h.includes(c)));

  const iOrderId = find("Order Number", "Order No", "orderNumber");
  const iStatus  = find("Status", "Order Status");
  const iAmount  = find("Paid Price", "Total Amount", "Price");
  const iDate    = find("Created at", "Order Date", "createdAt");
  const iProduct = find("Item Name", "Product Name", "SKU");

  const seen = new Set<string>();
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;

    const orderId = iOrderId >= 0 ? r[iOrderId]?.trim() : `row-${i}`;
    const status  = iStatus  >= 0 ? r[iStatus]?.trim()  : "";
    if (!orderId) continue;

    if (status.includes("canceled") || status.includes("Canceled") || status.includes("failed")) {
      cancelled++; continue;
    }
    if (status.includes("returned") || status.includes("Returned")) {
      returned++; continue;
    }

    if (seen.has(orderId)) continue;
    seen.add(orderId);

    const amount = parseFloat((iAmount >= 0 ? r[iAmount] : "0")?.replace(/,/g, "").trim() || "0");
    if (amount <= 0) { cancelled++; continue; }

    const date = parseISODate(iDate >= 0 ? r[iDate] : "");
    const desc = (iProduct >= 0 ? r[iProduct]?.trim() : "") || "Lazada";

    result.push({
      lineKey:     orderId,
      orderId:     orderId,
      skuLineId:   "",
      date,
      amount,
      platform:    "lazada",
      productName: desc.slice(0, 200),
      variant:     "",
    });
  }

  return {
    rows:      result,
    cancelled,
    returned,
    skipped:   cancelled + returned,
    total:     result.reduce((s, r) => s + r.amount, 0),
    platform:  "lazada",
  };
}

// ─── dispatcher ───────────────────────────────────────────────────────────────
export function parseFile(
  platform: "tiktok" | "shopee" | "lazada",
  rows: string[][],
  extraRows?: string[][]  // TikTok: รายละเอียดคำสั่งซื้อ rows for order counting
): ParseResult {
  if (platform === "tiktok")  return parseTikTok(rows, extraRows);
  if (platform === "shopee")  return parseShopee(rows);
  return parseLazada(rows);
}
