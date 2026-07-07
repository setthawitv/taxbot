import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/leads
// Stores segment data submitted by anonymous visitors on the public tax
// calculator (age / occupation / sales channel / income range) plus an
// optional snapshot of their tax estimate. No auth — this is a public lead form.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // This endpoint is public, so sanitize + bound every field to prevent
    // storage abuse and junk data. Free-text is capped and coerced to string.
    const str = (v: unknown, max = 60) =>
      typeof v === "string" ? v.trim().slice(0, max) : "";
    const num = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(v, 1e12)) : null;

    const age_range     = str(body.age_range);
    const occupation    = str(body.occupation);
    const sales_channel = str(body.sales_channel);
    const income_range  = str(body.income_range);
    const taxpayer_type = str(body.taxpayer_type, 20) || null;

    if (!age_range || !occupation || !sales_channel || !income_range) {
      return NextResponse.json({ error: "Missing segment fields" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("landing_leads").insert({
      age_range, occupation, sales_channel, income_range, taxpayer_type,
      est_income: num(body.est_income),
      est_tax:    num(body.est_tax),
    });

    if (error) {
      console.error("[leads] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[leads]", err);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
