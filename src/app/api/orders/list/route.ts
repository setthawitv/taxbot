import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/orders/list?userId=xxx&limit=100
// Returns recent orders across all platforms with a derived fulfillment status.
// Status is derived from order_date until the platform APIs supply the real state:
//   0–1 day  → to_ship (รอจัดส่ง)
//   2–3 days → shipping (กำลังจัดส่ง)
//   4+ days  → delivered (จัดส่งแล้ว)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = await authorizeUserId(searchParams.get("userId") ?? searchParams.get("lineUserId"));
  if (!userId) return NextResponse.json({ orders: [] });

  const limit = Math.min(parseInt(searchParams.get("limit") ?? "150"), 400);

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", userId).single();
  if (!user) return NextResponse.json({ orders: [] });

  const { data } = await supabaseAdmin
    .from("platform_orders")
    .select("id, platform, order_id, product_name, seller_sku, variant, amount, order_date")
    .eq("user_id", user.id)
    .order("order_date", { ascending: false })
    .limit(limit);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const orders = (data ?? []).map((o) => {
    const d = new Date(o.order_date);
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
    const status = daysAgo <= 1 ? "to_ship" : daysAgo <= 3 ? "shipping" : "delivered";
    return { ...o, status };
  });

  return NextResponse.json({ orders });
}
