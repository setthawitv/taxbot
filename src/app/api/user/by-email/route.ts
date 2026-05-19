import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  // Verify the caller has a valid Google session
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase().trim();

  // 1. Try direct owner match (user connected their own Google account)
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("id, line_user_id, business_name")
    .eq("google_email", email)
    .single();

  if (owner?.line_user_id) {
    return NextResponse.json({
      lineUserId:   owner.line_user_id,
      businessName: owner.business_name ?? "",
      email,
      role: "owner",
    });
  }

  // 2. Check if this email is an accepted admin for another account
  const { data: adminRow } = await supabaseAdmin
    .from("account_admins")
    .select("owner_user_id")
    .eq("admin_email", email)
    .eq("status", "accepted")
    .single();

  if (adminRow?.owner_user_id) {
    const { data: ownerUser } = await supabaseAdmin
      .from("users")
      .select("line_user_id, business_name")
      .eq("id", adminRow.owner_user_id)
      .single();

    if (ownerUser?.line_user_id) {
      return NextResponse.json({
        lineUserId:   ownerUser.line_user_id,
        businessName: ownerUser.business_name ?? "",
        email,
        role: "admin",
      });
    }
  }

  return NextResponse.json({ error: "User not found" }, { status: 404 });
}
