import { NextRequest, NextResponse } from "next/server";
import { createCharge, PLANS, PlanKey } from "@/lib/beam";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { lineUserId, plan, currentPlan } = await req.json();

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

    const referenceId = `taxbot_${plan}_${lineUserId}_${Date.now()}`;
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://taxbot-sage.vercel.app"}/payment/done`;

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
