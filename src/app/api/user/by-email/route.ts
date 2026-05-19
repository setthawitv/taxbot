import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  // Verify the caller has a valid Google session
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, line_user_id, business_name")
    .eq("google_email", email)
    .single();

  if (!data?.line_user_id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    lineUserId:   data.line_user_id,
    businessName: data.business_name ?? "",
    email,
  });
}
