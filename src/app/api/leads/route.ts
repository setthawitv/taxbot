import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/leads
// Stores segment data submitted by anonymous visitors on the public tax
// calculator (age / occupation / sales channel / income range) plus an
// optional snapshot of their tax estimate. No auth — this is a public lead form.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { age_range, occupation, sales_channel, income_range } = body;

    if (!age_range || !occupation || !sales_channel || !income_range) {
      return NextResponse.json({ error: "Missing segment fields" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("landing_leads").insert({
      age_range,
      occupation,
      sales_channel,
      income_range,
      taxpayer_type: body.taxpayer_type ?? null,
      est_income:    typeof body.est_income === "number" ? body.est_income : null,
      est_tax:       typeof body.est_tax === "number" ? body.est_tax : null,
    });

    if (error) {
      console.error("[leads] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[leads]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 }
    );
  }
}
