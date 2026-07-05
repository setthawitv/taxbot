import { NextRequest, NextResponse } from "next/server";
import { createCharge, createPaymentLink, PLANS, PlanKey } from "@/lib/beam";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, currentPlan } = body;
    const method: "qr" | "card" = body.method === "card" ? "card" : "qr";

    // Web (Google) users send their users.id as `userId`; LINE users may send
    // `lineUserId` directly. We always settle on the row's line_user_id, since
    // the Beam webhook upgrades the user by matching on line_user_id.
    let lineUserId: string | undefined = body.lineUserId;
    if (!lineUserId && body.userId) {
      const { data: u } = await supabaseAdmin
        .from("users")
        .select("line_user_id")
        .eq("id", body.userId)
        .single();
      lineUserId = u?.line_user_id ?? undefined;
    }

    if (!lineUserId || !plan) {
      return NextResponse.json({ error: "Missing lineUserId or plan" }, { status: 400 });
    }

    if (!PLANS[plan as PlanKey]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const planInfo = PLANS[plan as PlanKey];

    // Calculate charge amount — only the upgrade difference if upgrading from a paid plan
    const PLAN_THB: Record<string, number> = { trial: 0, free: 0, eco: 100, pro: 200, platinum: 700 };
    const currentPlanThb = PLAN_THB[currentPlan as string] ?? 0;
    const chargeThb      = currentPlanThb > 0 ? planInfo.thb - currentPlanThb : planInfo.thb;
    const chargeSatang   = chargeThb * 100;  // Beam uses satang

    const referenceId = `vendee_${plan}_${lineUserId}_${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.vendeefinance.com";
    const returnUrl = `${appUrl}/payment/done`;

    // ── Card / hosted-checkout path (Beam Payment Links) ──────────────────
    // Buyer is redirected to a Beam-hosted page (card + QR), then back to
    // /payment/done?linkRef=… where we confirm PAID and upgrade. No card data
    // touches our servers. QR flow below is left untouched.
    if (method === "card") {
      const link = await createPaymentLink({
        amount:      chargeSatang,
        referenceId,
        description: `Vendee ${planInfo.name} (${chargeThb} THB)`,
        redirectUrl: `${returnUrl}?linkRef=${encodeURIComponent(referenceId)}`,
      });
      console.log("[payment/create] Beam payment link:", JSON.stringify(link).slice(0, 300));

      const linkId  = link.id ?? link.paymentLinkId;
      const payUrl  = link.url;
      if (!linkId || !payUrl) {
        throw new Error("Beam did not return a payment link id/url");
      }

      // Store pending payment — charge_id holds the link id for reconciliation.
      await supabaseAdmin.from("payments").insert({
        line_user_id: lineUserId,
        charge_id:    linkId,
        plan,
        amount_thb:   chargeThb,
        status:       "pending",
        reference_id: referenceId,
      });

      return NextResponse.json({
        method:      "card",
        paymentUrl:  payUrl,
        referenceId,
        amount:      chargeThb,
        planName:    planInfo.name,
      });
    }

    const charge = await createCharge({
      amount:      chargeSatang,
      referenceId,
      returnUrl,
    });

    // Log full Beam response so we can see all fields
    console.log("[payment/create] Beam response:", JSON.stringify(charge, null, 2));

    // Save pending payment record
    await supabaseAdmin.from("payments").insert({
      line_user_id: lineUserId,
      charge_id:    charge.chargeId,
      plan,
      amount_thb:   chargeThb,
      status:       "pending",
      reference_id: referenceId,
    });

    // Extract QR from Beam's encodedImage response
    const encodedImage = charge.encodedImage as { imageBase64Encoded?: string; rawData?: string; expiry?: string } | undefined;
    const qrImage = encodedImage?.imageBase64Encoded
      ? `data:image/png;base64,${encodedImage.imageBase64Encoded}`
      : "";
    const qrData  = encodedImage?.rawData ?? "";

    return NextResponse.json({
      chargeId: charge.chargeId,
      qrImage,
      qrData,
      expiry:   encodedImage?.expiry ?? null,
      amount:   chargeThb,
      planName: planInfo.name,
      status:   charge.status ?? "PENDING",
    });
  } catch (err) {
    console.error("[payment/create]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment creation failed" },
      { status: 500 }
    );
  }
}
