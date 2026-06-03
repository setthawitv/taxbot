import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/lib/supabase";
import { parseFile, parseShopeeSummaryReport } from "@/lib/platform-import";

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
    let tiktokDetailRows: string[][] | undefined;
    let shopeeSummaryParsed: ReturnType<typeof parseShopeeSummaryReport> | undefined;

    if (name.endsWith(".csv")) {
      const text   = new TextDecoder("utf-8").decode(buffer);
      const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
      rows = result.data as string[][];
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const wb = XLSX.read(buffer, { type: "array" });

      let sheetName = wb.SheetNames[0];

      if (platform === "shopee") {
        const summarySheet = wb.SheetNames.find((n) => n === "Summary");
        if (summarySheet) {
          // Shopee Summary Report — compute total from Summary, individual rows from Income
          const incomeSheetName = wb.SheetNames.find((n) => n === "Income") ?? wb.SheetNames[0];
          const summaryRows = XLSX.utils.sheet_to_json<string[]>(
            wb.Sheets[summarySheet], { header: 1, defval: "" }
          ) as string[][];
          const incomeRowsRaw = XLSX.utils.sheet_to_json<string[]>(
            wb.Sheets[incomeSheetName], { header: 1, defval: "" }
          ) as string[][];
          shopeeSummaryParsed = parseShopeeSummaryReport(summaryRows, incomeRowsRaw);
        } else {
          const incomeSheet = wb.SheetNames.find(
            (n) => n === "Income" || n.toLowerCase() === "income"
          );
          if (incomeSheet) sheetName = incomeSheet;
        }
      }

      // TikTok Income Report — prefer "รายงาน" sheet; also read detail sheet for order counts
      if (platform === "tiktok") {
        const reportSheet = wb.SheetNames.find((n) => n === "รายงาน");
        if (reportSheet) {
          sheetName = reportSheet;
          const detailSheet = wb.SheetNames.find((n) => n === "รายละเอียดคำสั่งซื้อ");
          if (detailSheet) {
            tiktokDetailRows = XLSX.utils.sheet_to_json<string[]>(
              wb.Sheets[detailSheet], { header: 1, defval: "" }
            ) as string[][];
          }
        }
      }

      const ws = wb.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    } else {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" }, { status: 400 });
    }

    if (!shopeeSummaryParsed && rows.length < 2) {
      return NextResponse.json({ error: "ไฟล์ว่างหรือไม่มีข้อมูล" }, { status: 400 });
    }

    // ── Parse into normalised rows ────────────────────────────────────────────
    const parsed = shopeeSummaryParsed
      ?? parseFile(platform as "tiktok" | "shopee" | "lazada", rows, tiktokDetailRows);
    console.log("[import] platform:", platform, "rows:", parsed.rows.length, "total:", parsed.total);

    if (preview) {
      // ── Check which line_keys already exist in DB ───────────────────────────
      let existingKeys  = new Set<string>();
      const lineKeys    = parsed.rows.map((r) => r.lineKey);
      let overlapWarning = false;

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

          // Overlap detection for summary-style imports (TikTok & Shopee)
          if (parsed.periodStart && parsed.periodEnd) {
            const newStart  = parsed.periodStart;
            const newEnd    = parsed.periodEnd;
            const prefix    = platform === "tiktok" ? "tiktok_report_%" : "shopee_summary_%";
            const { data: existingReports } = await supabaseAdmin
              .from("platform_orders")
              .select("line_key")
              .eq("user_id", user.id)
              .eq("platform", platform)
              .like("line_key", prefix);

            if (existingReports && existingReports.length > 0) {
              for (const r of existingReports) {
                // line_key ends with _YYYYMMDD_YYYYMMDD (or _YYYYMMDDYYYYMMDD for Shopee)
                const raw    = r.line_key.replace(/^(tiktok_report_|shopee_summary_)/, "");
                const parts  = raw.split("_");
                if (parts.length < 2) continue;
                const exStart = `${parts[0].slice(0,4)}-${parts[0].slice(4,6)}-${parts[0].slice(6,8)}`;
                const exEnd   = `${parts[1].slice(0,4)}-${parts[1].slice(4,6)}-${parts[1].slice(6,8)}`;
                if (newStart <= exEnd && newEnd >= exStart) {
                  overlapWarning = true;
                  break;
                }
              }
            }
          }
        }
      }

      const newRows     = parsed.rows.filter((r) => !existingKeys.has(r.lineKey));
      const newCount    = newRows.length;
      const existingCount = parsed.rows.length - newCount;
      const newTotal    = newRows.reduce((s, r) => s + r.amount, 0);

      // For summary-mode imports: show individual orders in preview, not the aggregate row
      const previewRows = parsed.previewItems
        ? parsed.previewItems.slice(0, 5)
        : parsed.rows.slice(0, 5).map((r) => ({
            orderId:     r.orderId,
            date:        r.date,
            amount:      r.amount,
            description: r.variant ? `${r.productName} (${r.variant})` : r.productName,
          }));

      const isSummary = !!parsed.periodStart;
      return NextResponse.json({
        ok:            true,
        preview:       true,
        count:         parsed.orderCount ?? parsed.rows.length,
        newCount,
        newTotal,
        existingCount,
        cancelled:     parsed.cancelled,
        returned:      parsed.returned,
        skipped:       parsed.skipped,
        total:         parsed.total,
        overlapWarning,
        isSummary,
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
