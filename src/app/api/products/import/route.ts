import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// POST /api/products/import  multipart: file + lineUserId
// Accepts ZORT-compatible Excel template
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file       = form.get("file")       as File   | null;
  const lineUserId = form.get("lineUserId") as string | null;
  const previewOnly = form.get("preview") === "true";

  if (!file || !lineUserId)
    return NextResponse.json({ error: "missing file or lineUserId" }, { status: 400 });

  // Resolve user
  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  // Parse Excel
  const buf = await file.arrayBuffer();
  const wb  = XLSX.read(buf, { type: "array" });
  const ws  = wb.Sheets[wb.SheetNames[0]];

  // Sheet has 2 header rows (row 0 = group, row 1 = field names, row 2+ = data)
  const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];

  // Find header row (row with "ชื่อสินค้า" or "รหัสสินค้า")
  let headerRowIdx = raw.findIndex((r) =>
    r.some((c) => String(c).includes("ชื่อสินค้า") || String(c).includes("รหัสสินค้า"))
  );
  if (headerRowIdx < 0) headerRowIdx = 1; // fallback

  const headers = raw[headerRowIdx].map((h) => String(h).trim());
  const dataRows = raw.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== ""));

  function col(row: string[], ...names: string[]) {
    for (const n of names) {
      const idx = headers.findIndex((h) => h.includes(n));
      if (idx >= 0) return String(row[idx] ?? "").trim();
    }
    return "";
  }

  type ProductRow = {
    user_id: string; is_active: boolean; sku: string | null; parent_sku: string | null;
    name: string; category: string | null; unit: string;
    cost_price: number; sell_price: number; stock_qty: number;
    barcode: string | null; attr1_type: string | null; attr1_val: string | null;
    _tiktok: string; _shopee: string; _lazada: string;
  };

  const products: ProductRow[] = dataRows.map((row) => ({
    user_id:     user.id,
    is_active:   true,
    sku:         col(row, "รหัสสินค้า") || null,
    parent_sku:  col(row, "รหัสสินค้าหลัก") || null,
    name:        col(row, "ชื่อสินค้า"),
    category:    col(row, "หมวดหมู่") || null,
    unit:        col(row, "หน่วยสินค้า", "หน่วย") || "ชิ้น",
    cost_price:  parseFloat(col(row, "ราคาต่อหน่วย", "ราคาซื้อ", "ราคาต้นทุน")) || 0,
    sell_price:  parseFloat(col(row, "ราคาขาย")) || 0,
    stock_qty:   parseInt(col(row, "จำนวนหน่วย", "ยอดยกมา")) || 0,
    barcode:     col(row, "Barcode") || null,
    attr1_type:  col(row, "ประเภทคุณสมบัติ") || null,
    attr1_val:   col(row, "Variant", "ตัวเลือก", "คุณสมบัติ") || null,
    // platform mapping helpers (not persisted in products table)
    _tiktok:     col(row, "ชื่อบน TikTok", "TikTok"),
    _shopee:     col(row, "ชื่อบน Shopee", "Shopee"),
    _lazada:     col(row, "ชื่อบน Lazada", "Lazada"),
  })).filter((p) => p.name);

  if (previewOnly) {
    return NextResponse.json({ products, count: products.length });
  }

  // Upsert products (sku + user_id as unique key if sku exists)
  let saved = 0;
  let mappingsSaved = 0;
  const movements: object[] = [];

  for (const p of products) {
    const { _tiktok, _shopee, _lazada, ...productData } = p;

    let productId: string | null = null;
    let existing = null;
    if (productData.sku) {
      const { data } = await supabaseAdmin
        .from("products").select("id, stock_qty")
        .eq("user_id", user.id).eq("sku", productData.sku).maybeSingle();
      existing = data;
    }

    if (existing) {
      const { error: upErr } = await supabaseAdmin.from("products").update(productData).eq("id", existing.id);
      if (upErr) { console.error("[import] update error:", upErr.message); continue; }
      productId = existing.id;
      const diff = productData.stock_qty - (existing.stock_qty ?? 0);
      if (diff !== 0) {
        movements.push({
          user_id: user.id, product_id: existing.id,
          type: diff > 0 ? "in" : "adjust", qty: diff,
          stock_after: productData.stock_qty, ref_type: "import_excel", note: "นำเข้า Excel",
        });
      }
    } else {
      const { data: newP, error: insErr } = await supabaseAdmin
        .from("products").insert(productData).select("id").single();
      if (insErr) { console.error("[import] insert error:", insErr.message); continue; }
      productId = newP?.id ?? null;
      if (newP && productData.stock_qty > 0) {
        movements.push({
          user_id: user.id, product_id: newP.id,
          type: "in", qty: productData.stock_qty,
          stock_after: productData.stock_qty, ref_type: "import_excel", note: "ยอดยกมา",
        });
      }
    }
    saved++;

    // Save platform name mappings from template columns
    if (productId) {
      const platformEntries: { platform: string; platform_name: string }[] = [];
      if (_tiktok) platformEntries.push({ platform: "tiktok", platform_name: _tiktok });
      if (_shopee) platformEntries.push({ platform: "shopee", platform_name: _shopee });
      if (_lazada) platformEntries.push({ platform: "lazada", platform_name: _lazada });

      for (const entry of platformEntries) {
        await supabaseAdmin.from("product_platform_names").upsert(
          { user_id: user.id, product_id: productId, platform: entry.platform, platform_name: entry.platform_name },
          { onConflict: "user_id,platform,platform_name", ignoreDuplicates: false }
        );
        mappingsSaved++;
      }
    }
  }

  if (movements.length > 0) {
    await supabaseAdmin.from("stock_movements").insert(movements);
  }

  return NextResponse.json({ ok: true, saved, mappingsSaved, movements: movements.length });
}
