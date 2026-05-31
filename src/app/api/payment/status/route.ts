import { NextRequest, NextResponse } from "next/server";
import { getCharge } from "@/lib/beam";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const chargeId = req.nextUrl.searchParams.get("chargeId");
    if (!chargeId) {
      return NextResponse.json({ error: "Missing chargeId" }, { status: 400 });
    }

    const charge = await getCharge(chargeId);

    // Beam may return status in different field names
    const rawStatus = String(
      charge.status ?? charge.chargeStatus ?? charge.paymentStatus ?? ""
    ).toUpperCase();

    // Also check transactionTime — if set, payment was received
    const hasTransactionTime = !!(charge as Record<string, unknown>).transactionTime;

    const normalised =
      hasTransactionTime ||
      rawStatus === "SUCCESS" || rawStatus === "PAID" || rawStatus === "COMPLETED" ||
      rawStatus === "SETTLED" || rawStatus === "CAPTURED" || rawStatus === "CHARGE_COMPLETED" ||
      rawStatus === "PAYMENT_COMPLETED" || rawStatus === "APPROVED"
        ? "COMPLETED"
        : rawStatus === "FAILED" || rawStatus === "CANCELLED" || rawStatus === "EXPIRED" ||
          rawStatus === "CHARGE_FAILED" || rawStatus === "CHARGE_EXPIRED"
        ? "FAILED"
        : "PENDING";

    console.log("[payment/status] chargeId:", chargeId, "raw:", rawStatus, "transactionTime:", hasTransactionTime, "→", normalised);

    // If completed — upgrade the user's plan
    if (normalised === "COMPLETED") {
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .select("line_user_id, plan")
        .eq("charge_id", chargeId)
        .single();

      if (payment) {
        // Update user plan (expires in 30 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await supabaseAdmin
          .from("users")
          .update({
            plan:             payment.plan,
            plan_expires_at:  expiresAt.toISOString(),
          })
          .eq("line_user_id", payment.line_user_id);

        // Mark payment as completed
        await supabaseAdmin
          .from("payments")
          .update({ status: "completed" })
          .eq("charge_id", chargeId);
      }
    }

    return NextResponse.json({ status: normalised, _raw: charge });
  } catch (err) {
    console.error("[payment/status]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
