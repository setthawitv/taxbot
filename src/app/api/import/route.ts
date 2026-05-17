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
      const wb    = XLSX.read(buffer, { type: "array" });
      const ws    = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    } else {
      return NextResponse.json({ error: "รองรับเฉพาะไฟล์ .csv, .xlsx, .xls" }, { status: 400 });
    }

    if (rows.length < 2) {
      return NextResponse.json({ error: "ไฟล์ว่างหรือไม่มีข้อมูล" }, { status: 400 });
    }

    // ── Parse into normalised rows ────────────────────────────────────────────
    const parsed = parseFile(platform as "tiktok" | "shopee" | "lazada", rows);

    if (preview) {
      // Return summary without saving
      return NextResponse.json({
        ok: true,
        preview: true,
        count:   parsed.rows.length,
        skipped: parsed.skipped,
        total:   parsed.total,
        rows:    parsed.rows.slice(0, 5), // first 5 for UI preview
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

    // Upsert using (user_id + source + external_order_id) to prevent duplicates
    const records = parsed.rows.map((r) => ({
      user_id:           user.id,
      type:              "income" as const,
      amount:            r.amount,
      vendor:            r.vendor,
      description:       r.description,
      source:            r.source,
      transaction_date:  r.date,
      external_order_id: r.orderId,
    }));

    // Insert with conflict ignore so re-importing the same file is safe
    const { error } = await supabaseAdmin
      .from("transactions")
      .upsert(records, {
        onConflict:       "user_id,external_order_id",
        ignoreDuplicates: true,
      });

    if (error) {
      // Fallback: if external_order_id column or unique constraint missing, do plain insert
      if (String(error.message).includes("external_order_id") ||
          String(error.code) === "PGRST204") {
        const { error: e2 } = await supabaseAdmin
          .from("transactions")
          .insert(records);
        if (e2) throw e2;
      } else {
        throw error;
      }
    }

    return NextResponse.json({
      ok:      true,
      saved:   parsed.rows.length,
      skipped: parsed.skipped,
      total:   parsed.total,
    });

  } catch (err) {
    console.error("[import] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
