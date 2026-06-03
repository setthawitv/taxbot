import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase";
import { parseFile } from "@/lib/platform-import";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file      = formData.get("file")     as File   | null;
    const platform  = formData.get("platform") as string | null;
    const lineUserId = formData.get("lineUserId") as string | null;
    const preview   = formData.get("preview")  === "true"; // true = parse only, false = save

    if (!file || !platform || !lineUserId) {
      return NextResponse.json({ error: "Missing file, platform, or lineUserId" }, { status: 400 });
    }
    if (!["tiktok", "shopee", "lazada"].includes(platform)) {
      return NextResponse.json({ error: "Unknown platform" }, { status: 400 });
    }

    // ── Read file into 2-D string array ──────────────────────────────────────
    const buffer  = await file.arrayBuffer();
    const name    = file.name.toLowerCase();
    let rows: string[][] = [];

    if (name.endsWith(".csv")) {
      const text   = new TextDecoder("utf-8").decode(buffer);
      const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
      rows = result.data as string[][];
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "array" });

      let sheetName = wb.SheetNames[0];
      if (platform === "shopee") {
        const incomeSheet = wb.SheetNames.find(
          (n) => n === "Income" || n.toLowerCase() === "income"
        );
        if (incomeSheet) sheetName = incomeSheet;
      }
      // TikTok Income Report — prefer "รายงาน" sheet (summary) over "รายละเอียดคำสั่งซื้อ"
      if (platform === "tiktok") {
        const reportSheet = wb.SheetNames.find((n) => n === "รายงาน");
        if (reportSheet) sheetName = reportSheet;
      }

      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    } else {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" }, { status: 400 });
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: "ไฟล์ว่างหรือไม่มีข้อมูล" }, { status: 400 });
    }

    // Debug: log header row so we can see actual column names
    console.log("[import] headers:", rows[0]);

    // ── Parse into normalised rows ────────────────────────────────────────────
    const parsed = parseFile(platform as "tiktok" | "shopee" | "lazada", rows);

    if (preview) {
      // ── Check which line_keys already exist in DB ───────────────────────────
      let existingKeys  = new Set<string>();
      const lineKeys    = parsed.rows.map((r) => r.lineKey);

      if (lineUserId !== "preview" && lineKeys.length > 0) {
        const { data: user } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("line_user_id", lineUserId)
          .single();

        if (user) {
          const { data: existing } = await supabaseAdmin
            .from("platform_orders")
            .select("line_key")
            .eq("user_id", user.id)
            .in("line_key", lineKeys);

          existingKeys = new Set((existing ?? []).map((e) => e.line_key));
        }
      }

      const newRows     = parsed.rows.filter((r) => !existingKeys.has(r.lineKey));
      const newCount    = newRows.length;
      const existingCount = parsed.rows.length - newCount;
      const newTotal    = newRows.reduce((s, r) => s + r.amount, 0);

      // Normalise to the shape the UI expects — show raw orderId (not lineKey) in preview
      const previewRows = parsed.rows.slice(0, 5).map((r) => ({
        orderId:     r.orderId,
        date:        r.date,
        amount:      r.amount,
        description: r.variant ? `${r.productName} (${r.variant})` : r.productName,
      }));

      return NextResponse.json({
        ok:            true,
        preview:       true,
        count:         parsed.rows.length,   // total successful in file
        newCount,                            // not yet in DB
        newTotal,                            // amount of new rows only
        existingCount,                       // already imported before
        cancelled:     parsed.cancelled,
        returned:      parsed.returned,
        skipped:       parsed.skipped,
        total:         parsed.total,         // total amount in file (all)
        rows:          previewRows,
        platform,
      });
    }

    // ── Save to DB ────────────────────────────────────────────────────────────
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("line_user_id", lineUserId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }

    if (parsed.rows.length === 0) {
      return NextResponse.json({ ok: true, saved: 0, skipped: parsed.skipped, total: 0 });
    }

    // Build platform_orders records
    const records = parsed.rows.map((r) => ({
      user_id:      user.id,
      platform:     r.platform,
      order_id:     r.orderId,
      sku_line_id:  r.skuLineId || null,
      line_key:     r.lineKey,
      product_name: r.productName,
      variant:      r.variant || null,
      amount:       r.amount,
      order_date:   r.date,
    }));

    // Upsert into platform_orders — (user_id, line_key) is unique
    const { error: upsertErr } = await supabaseAdmin
      .from("platform_orders")
      .upsert(records, { onConflict: "user_id,line_key", ignoreDuplicates: true });

    if (upsertErr) {
      const errMsg = upsertErr.message ?? JSON.stringify(upsertErr);
      console.error("[import] upsert error:", errMsg);
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    return NextResponse.json({
      ok:      true,
      saved:   parsed.rows.length,
      skipped: parsed.skipped,
      total:   parsed.total,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : JSON.stringify(err);
    console.error("[import] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
