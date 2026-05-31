import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[webhook/beam] received:", JSON.stringify(body).slice(0, 500));

    // Beam webhook payload — try multiple field name patterns
    const chargeId: string =
      body.chargeId ??
      body.charge_id ??
      body.data?.chargeId ??
      body.data?.charge_id ??
      body.id ??
      "";

    // Status field — normalise to COMPLETED / PENDING / FAILED
    const rawStatus: string = String(
      body.status ??
      body.data?.status ??
      body.chargeStatus ??
      body.data?.chargeStatus ??
      body.event ??
      ""
    ).toUpperCase();

    const isCompleted =
      rawStatus.includes("COMPLET") ||
      rawStatus.includes("SUCCESS") ||
      rawStatus.includes("PAID") ||
      rawStatus.includes("CHARGE.PAID") ||
      rawStatus.includes("CHARGE.COMPLETED");

    console.log("[webhook/beam] chargeId:", chargeId, "rawStatus:", rawStatus, "isCompleted:", isCompleted);

    if (!chargeId) {
      console.warn("[webhook/beam] no chargeId found in payload");
      return NextResponse.json({ ok: true }); // always 200 to avoid Beam retries
    }

    if (isCompleted) {
      // Look up payment record
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("line_user_id, plan, status")
        .eq("charge_id", chargeId)
        .single();

      if (!payment) {
        console.warn("[webhook/beam] no payment record for chargeId:", chargeId);
        return NextResponse.json({ ok: true });
      }

      if (payment.status === "completed") {
        console.log("[webhook/beam] already completed, skipping");
        return NextResponse.json({ ok: true });
      }

      // Upgrade user plan (30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabaseAdmin
        .from("users")
        .update({
          plan:            payment.plan,
          plan_expires_at: expiresAt.toISOString(),
        })
        .eq("line_user_id", payment.line_user_id);

      await supabaseAdmin
        .from("payments")
        .update({ status: "completed" })
        .eq("charge_id", chargeId);

      console.log("[webhook/beam] ✅ upgraded", payment.line_user_id, "→", payment.plan);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[webhook/beam] error:", err);
    // Still return 200 so Beam doesn't keep retrying
    return NextResponse.json({ ok: true });
  }
}
