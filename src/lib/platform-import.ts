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

export type ParseResult = {
  rows:      ImportedRow[];
  cancelled: number;   // cancelled orders
  returned:  number;   // returned / refunded orders
  skipped:   number;   // cancelled + returned (for backward compat)
  total:     number;   // sum of amount
  platform:  "tiktok" | "shopee" | "lazada";
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function parseThaiDate(raw: string): string {
  // TikTok: "27/04/2026 20:56:55"  →  2026-04-27
  const m = String(raw ?? "").trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseISODate(raw: string): string {
  // Shopee / Lazada: "2026-04-27 20:56:55"
  const m = String(raw ?? "").trim().match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : new Date().toISOString().slice(0, 10);
}

// ─── TikTok ───────────────────────────────────────────────────────────────────
// Unique key = Order ID + SKU ID (line-item level)
// Amount     = per-item net ("Seller Revenue" / col 15), NOT total order amount
// Reason: same SKU ID can appear in different orders (different customers),
//         same Order ID can have multiple SKU IDs (multi-item order).
//         Only the combination Order ID + SKU ID is truly unique per line.
export function parseTikTok(rows: string[][]): ParseResult {
  const header = rows[0].map((h) => h.trim());
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

  // Log resolved indices for debugging
  console.log("[TikTok parser] column map:", {
    iOrderId, iStatus, iSkuId, iRevenue, iUnitPrice, iDiscount, iPaidTime, iProduct, iVariant,
    totalCols: header.length,
  });

  const seen = new Set<string>(); // key = orderId_skuId
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;

    const orderId = r[iOrderId]?.trim();
    const status  = r[iStatus]?.trim() ?? "";
    if (!orderId) continue;

    // Skip cancelled
    if (status.includes("ยกเลิก") || status.includes("Cancel")) {
      cancelled++;
      continue;
    }
    // Skip returned / refunded
    if (status.includes("Return") || status.includes("คืน") || status.includes("Refund")) {
      returned++;
      continue;
    }

    // Unique key = Order ID + SKU line-item ID
    const skuId   = iSkuId >= 0 ? (r[iSkuId]?.trim() || "") : "";
    const lineKey = skuId ? `${orderId}_${skuId}` : orderId;

    if (seen.has(lineKey)) {
      console.log(`[TikTok skip] row ${i} DUPLICATE key=${lineKey}`);
      continue;
    }
    seen.add(lineKey);

    // Per-item net revenue — try named column first, then compute from price - discount,
    // then fallback to col-15 (positional, consistent across known TikTok exports)
    let net = 0;
    if (iRevenue >= 0) {
      net = parseFloat(r[iRevenue]?.trim() || "0");
    } else if (iUnitPrice >= 0 && iDiscount >= 0) {
      const price    = parseFloat(r[iUnitPrice]?.trim() || "0");
      const discount = parseFloat(r[iDiscount]?.trim()  || "0");
      net = price - discount;
    } else {
      // positional fallback: col 15 = per-item net in known TikTok layouts
      net = parseFloat(r[15]?.trim() || "0");
    }

    if (net <= 0) {
      console.log(`[TikTok skip] row ${i} NET_ZERO net=${net} orderId=${orderId} col15="${r[15]}" iRevenue=${iRevenue}`);
      cancelled++; // treat zero-net as effectively cancelled
      continue;
    }

    const date        = parseThaiDate(r[iPaidTime] ?? "");
    const productName = (r[iProduct]?.trim() || "TikTok Shop").slice(0, 200);
    const variant     = (iVariant >= 0 ? r[iVariant]?.trim() : "") || "";

    result.push({
      lineKey:     lineKey,
      orderId:     orderId,
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
// Shopee TH export — all headers in Thai (verified from real file)
// col 0  หมายเลขคำสั่งซื้อ   = Order ID
// col 1  สถานะการสั่งซื้อ     = Order Status  ("สำเร็จแล้ว" | "ยกเลิกแล้ว")
// col 4  สถานะการคืนเงิน...   = Return/Refund status
// col 6  วันที่ทำการสั่งซื้อ   = Order Date  (YYYY-MM-DD HH:MM)
// col 18 ชื่อสินค้า             = Product Name
// col 19 เลขอ้างอิง SKU         = SKU Reference (line-item unique ID)
// col 20 ชื่อตัวเลือก           = Variant
// col 25 ราคาขายสุทธิ           = Net sale price per item (after Shopee discount)
// col 40 ราคาสินค้าที่ชำระ...  = Amount paid by buyer (may be order total)
// Unique key = Order ID + SKU Reference (same pattern as TikTok)
export function parseShopee(rows: string[][]): ParseResult {
  const header = rows[0].map((h) => String(h ?? "").trim());
  const find = (...candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h.includes(c)));

  const iOrderId  = find("หมายเลขคำสั่งซื้อ", "Order ID", "เลขที่คำสั่งซื้อ");
  const iStatus   = find("สถานะการสั่งซื้อ", "Order Status", "สถานะ");
  const iReturn   = find("สถานะการคืนเงินหรือคืนสินค้า", "สถานะการคืน");
  const iDate     = find("วันที่ทำการสั่งซื้อ", "Order Creation Date", "วันที่สร้าง");
  const iProduct  = find("ชื่อสินค้า", "Product Name", "Item Name");
  const iSkuRef   = find("เลขอ้างอิง SKU", "SKU Reference", "SKU Ref");
  const iVariant  = find("ชื่อตัวเลือก", "Variation", "SKU Variation");
  const iNetPrice = find("ราคาขายสุทธิ", "Net Price", "Seller Net Price");
  const iQty      = find("จำนวน", "Quantity", "Qty");

  console.log("[Shopee parser] columns:", {
    iOrderId, iStatus, iReturn, iDate, iProduct, iSkuRef, iVariant, iNetPrice, iQty,
  });

  const seen        = new Set<string>();
  const orderCount  = new Map<string, number>(); // orderId → row count within order
  const result: ImportedRow[] = [];
  let cancelled = 0;
  let returned  = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;

    const orderId = (iOrderId >= 0 ? r[iOrderId] : "")?.trim();
    if (!orderId) continue;

    const status       = (iStatus >= 0 ? r[iStatus] : "")?.trim() ?? "";
    const returnStatus = (iReturn >= 0 ? r[iReturn] : "")?.trim() ?? "";

    if (status.includes("ยกเลิก") || status.includes("Cancel")) {
      cancelled++; continue;
    }
    // returnStatus = "คำขอได้รับการยอมรับแล้ว" when Shopee accepted return request
    if (
      returnStatus !== "" &&
      returnStatus !== "-" &&
      (returnStatus.includes("คืน") || returnStatus.includes("Return") ||
       returnStatus.includes("Refund") || returnStatus.includes("ยอมรับ") ||
       returnStatus.includes("Accepted") || returnStatus.includes("accepted"))
    ) {
      returned++; continue;
    }

    // Unique key: prefer skuRef, fall back to orderId_N (N = position within order)
    // This handles multi-SKU orders where skuRef might be identical or empty
    const skuRef = (iSkuRef >= 0 ? r[iSkuRef] : "")?.trim() || "";
    const seq    = (orderCount.get(orderId) ?? 0) + 1;
    orderCount.set(orderId, seq);
    const lineKey = skuRef ? `${orderId}_${skuRef}` : `${orderId}_${seq}`;

    if (seen.has(lineKey)) { continue; }
    seen.add(lineKey);

    // Net price per item × quantity
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
  rows: string[][]
): ParseResult {
  if (platform === "tiktok")  return parseTikTok(rows);
  if (platform === "shopee")  return parseShopee(rows);
  return parseLazada(rows);
}
