/**
 * Parses order export files from TikTok Shop, Shopee, and Lazada
 * into a normalised list of income transactions.
 */

export type ImportedRow = {
  orderId:    string;
  date:       string;   // YYYY-MM-DD
  amount:     number;
  vendor:     string;   // platform name
  description: string;
  source:     "tiktok" | "shopee" | "lazada";
};

export type ParseResult = {
  rows:      ImportedRow[];
  skipped:   number;   // cancelled / returned orders
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
// CSV columns (0-indexed):
//  0  Order ID      1  Order Status    22 Order Amount
//  25 Paid Time     8  Product Name
export function parseTikTok(rows: string[][]): ParseResult {
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h === name);

  const iOrderId    = idx("Order ID");
  const iStatus     = idx("Order Status");
  const iAmount     = idx("Order Amount");
  const iRefund     = idx("Order Refund Amount");
  const iPaidTime   = idx("Paid Time");
  const iProduct    = idx("Product Name");

  const seen = new Set<string>();
  const result: ImportedRow[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;

    const orderId = r[iOrderId]?.trim();
    const status  = r[iStatus]?.trim() ?? "";
    if (!orderId) continue;

    // Skip cancelled / returned
    if (status.includes("ยกเลิก") || status.includes("Cancel") ||
        status.includes("Return")  || status.includes("คืน")) {
      skipped++;
      continue;
    }

    // Deduplicate — TikTok repeats the order row for each SKU
    if (seen.has(orderId)) continue;
    seen.add(orderId);

    const amount  = parseFloat(r[iAmount]?.trim() || "0");
    const refund  = parseFloat(r[iRefund]?.trim() || "0");
    const net     = amount - refund;
    if (net <= 0) { skipped++; continue; }

    const date = parseThaiDate(r[iPaidTime] ?? "");
    const desc = r[iProduct]?.trim() || "TikTok Shop";

    result.push({
      orderId,
      date,
      amount: net,
      vendor: "TikTok Shop",
      description: desc.length > 60 ? desc.slice(0, 57) + "…" : desc,
      source: "tiktok",
    });
  }

  return {
    rows: result,
    skipped,
    total: result.reduce((s, r) => s + r.amount, 0),
    platform: "tiktok",
  };
}

// ─── Shopee ───────────────────────────────────────────────────────────────────
// Shopee order report typical columns:
//  "Order ID" / "เลขที่คำสั่งซื้อ"
//  "Order Status" / "สถานะ"
//  "Total Amount" / "ยอดรวม"
//  "Order Creation Date" / "วันที่สร้าง"
//  "Product Name(s)" / "ชื่อสินค้า"
export function parseShopee(rows: string[][]): ParseResult {
  const header = rows[0].map((h) => h.trim());
  const find = (...candidates: string[]) =>
    header.findIndex((h) => candidates.some((c) => h.includes(c)));

  const iOrderId  = find("Order ID", "เลขที่คำสั่งซื้อ", "Order No");
  const iStatus   = find("Order Status", "สถานะ", "Status");
  const iAmount   = find("Total Amount", "ยอดรวม", "Total Order Amount", "จำนวนเงิน");
  const iDate     = find("Order Creation Date", "วันที่สร้างคำสั่งซื้อ", "Creation Time", "วันที่");
  const iProduct  = find("Product Name", "ชื่อสินค้า", "Item Name");

  const seen = new Set<string>();
  const result: ImportedRow[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;

    const orderId = iOrderId >= 0 ? r[iOrderId]?.trim() : `row-${i}`;
    const status  = iStatus  >= 0 ? r[iStatus]?.trim()  : "";
    if (!orderId) continue;

    if (status.includes("ยกเลิก") || status.includes("Cancelled") ||
        status.includes("Return")  || status.includes("คืน")) {
      skipped++; continue;
    }

    if (seen.has(orderId)) continue;
    seen.add(orderId);

    const amount = parseFloat((iAmount >= 0 ? r[iAmount] : "0")?.replace(/,/g, "").trim() || "0");
    if (amount <= 0) { skipped++; continue; }

    const date = parseISODate(iDate >= 0 ? r[iDate] : "");
    const desc = (iProduct >= 0 ? r[iProduct]?.trim() : "") || "Shopee";

    result.push({
      orderId,
      date,
      amount,
      vendor: "Shopee",
      description: desc.length > 60 ? desc.slice(0, 57) + "…" : desc,
      source: "shopee",
    });
  }

  return {
    rows: result,
    skipped,
    total: result.reduce((s, r) => s + r.amount, 0),
    platform: "shopee",
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
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 3) continue;

    const orderId = iOrderId >= 0 ? r[iOrderId]?.trim() : `row-${i}`;
    const status  = iStatus  >= 0 ? r[iStatus]?.trim()  : "";
    if (!orderId) continue;

    if (status.includes("canceled") || status.includes("Canceled") ||
        status.includes("returned") || status.includes("failed")) {
      skipped++; continue;
    }

    if (seen.has(orderId)) continue;
    seen.add(orderId);

    const amount = parseFloat((iAmount >= 0 ? r[iAmount] : "0")?.replace(/,/g, "").trim() || "0");
    if (amount <= 0) { skipped++; continue; }

    const date = parseISODate(iDate >= 0 ? r[iDate] : "");
    const desc = (iProduct >= 0 ? r[iProduct]?.trim() : "") || "Lazada";

    result.push({
      orderId,
      date,
      amount,
      vendor: "Lazada",
      description: desc.length > 60 ? desc.slice(0, 57) + "…" : desc,
      source: "lazada",
    });
  }

  return {
    rows: result,
    skipped,
    total: result.reduce((s, r) => s + r.amount, 0),
    platform: "lazada",
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
