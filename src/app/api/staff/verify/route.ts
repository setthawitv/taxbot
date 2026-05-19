import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/staff/verify?code=XXXXXXXX
// Returns owner info if the code is valid and active
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from("staff_invites")
    .select("id, owner_user_id, label, is_active")
    .eq("code", code)
    .single();

  if (!invite)           return NextResponse.json({ error: "Invalid code" },   { status: 404 });
  if (!invite.is_active) return NextResponse.json({ error: "Invite disabled" }, { status: 403 });

  // Fetch owner display name
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("display_name, line_user_id")
    .eq("id", invite.owner_user_id)
    .single();

  return NextResponse.json({
    valid: true,
    ownerName: owner?.display_name ?? "เจ้าของร้าน",
    ownerUserId: owner?.line_user_id,
    label: invite.label,
  });
}
