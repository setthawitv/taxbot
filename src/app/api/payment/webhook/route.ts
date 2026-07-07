import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getCharge, getPaymentLink } from "@/lib/beam";

// The webhook endpoint is public and unauthenticated, so we must NOT trust the
// posted body's status. Instead we re-verify the payment directly with Beam
// (getCharge / getPaymentLink) before upgrading. A forged webhook therefore
// cannot grant a plan — Beam itself must confirm the charge is paid, and any
// upgrade only affects the account tied to that payment record.

/** Ask Beam whether a charge id is actually paid. */
async function chargeIsPaid(chargeId: string): Promise<boolean> {
  try {
    const c = await getCharge(chargeId);
    const status = String((c.status ?? (c as Record<string, unknown>).chargeStatus ?? "")).toUpperCase();
    const hasTxnTime = !!(c as Record<string, unknown>).transactionTime;
    return hasTxnTime || ["SUCCESS", "SUCCEEDED", "PAID", "COMPLETED", "SETTLED", "CAPTURED", "APPROVED"].includes(status);
  } catch (e) {
    console.error("[webhook/beam] getCharge verify failed:", e);
    return false;
  }
}

/** Ask Beam whether a payment link (card flow) is paid. */
async function linkIsPaid(linkId: string): Promise<boolean> {
  try {
    const l = await getPaymentLink(linkId);
    return String(l.status ?? "").toUpperCase() === "PAID";
  } catch (e) {
    console.error("[webhook/beam] getPaymentLink verify failed:", e);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[webhook/beam] received:", JSON.stringify(body).slice(0, 500));

    const chargeId: string =
      body.chargeId ?? body.charge_id ?? body.data?.chargeId ?? body.data?.charge_id ?? body.id ?? "";
    // Payment-link (card) charges carry the link id as `sourceId`; we store the
    // link id in payments.charge_id, so we can match/verify on that too.
    const sourceId: string =
      body.sourceId ?? body.source_id ?? body.data?.sourceId ?? body.data?.source_id ?? "";

    if (!chargeId && !sourceId) {
      console.warn("[webhook/beam] no charge/source id in payload");
      return NextResponse.json({ ok: true }); // always 200 to avoid Beam retries
    }

    // Locate the pending payment record this webhook refers to.
    let payment: { line_user_id: string; plan: string; status: string } | null = null;
    let matchedChargeId = "";
    for (const key of [chargeId, sourceId].filter(Boolean)) {
      const { data } = await supabaseAdmin
        .from("payments")
        .select("line_user_id, plan, status")
        .eq("charge_id", key)
        .single();
      if (data) { payment = data; matchedChargeId = key; break; }
    }

    if (!payment) {
      console.warn("[webhook/beam] no payment record for", chargeId, sourceId);
      return NextResponse.json({ ok: true });
    }
    if (payment.status === "completed") {
      return NextResponse.json({ ok: true });
    }

    // ── Re-verify with Beam (do NOT trust the posted status) ─────────────────
    const paid =
      (chargeId && (await chargeIsPaid(chargeId))) ||
      (matchedChargeId && matchedChargeId === sourceId && (await linkIsPaid(sourceId))) ||
      (sourceId && (await linkIsPaid(sourceId)));

    if (!paid) {
      console.warn("[webhook/beam] Beam did not confirm payment — ignoring", chargeId, sourceId);
      return NextResponse.json({ ok: true });
    }

    // Upgrade user plan (30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await supabaseAdmin
      .from("users")
      .update({ plan: payment.plan, plan_expires_at: expiresAt.toISOString() })
      .eq("line_user_id", payment.line_user_id);

    await supabaseAdmin
      .from("payments")
      .update({ status: "completed" })
      .eq("charge_id", matchedChargeId);

    console.log("[webhook/beam] ✅ verified + upgraded", payment.line_user_id, "→", payment.plan);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/beam] error:", err);
    return NextResponse.json({ ok: true }); // Still 200 so Beam doesn't keep retrying
  }
}
