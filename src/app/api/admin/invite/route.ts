import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/admin/invite?lineUserId=xxx  — list all admins for owner
export async function GET(req: NextRequest) {
  const lineUserId = new URL(req.url).searchParams.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: admins } = await supabaseAdmin
    .from("account_admins")
    .select("id, admin_email, admin_name, invite_code, status, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ admins: admins ?? [] });
}

// POST /api/admin/invite — add admin by email
export async function POST(req: NextRequest) {
  const { lineUserId, adminEmail } = await req.json();
  if (!lineUserId || !adminEmail)
    return NextResponse.json({ error: "Missing lineUserId or adminEmail" }, { status: 400 });

  const email = adminEmail.trim().toLowerCase();

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check not inviting yourself
  const { data: self } = await supabaseAdmin
    .from("users").select("google_email").eq("id", user.id).single();
  if (self?.google_email?.toLowerCase() === email)
    return NextResponse.json({ error: "ไม่สามารถเพิ่มตัวเองเป็น Admin ได้" }, { status: 400 });

  // Upsert (re-invite if already exists)
  const { data: invite, error } = await supabaseAdmin
    .from("account_admins")
    .upsert({ owner_user_id: user.id, admin_email: email, status: "pending" },
             { onConflict: "owner_user_id,admin_email" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite });
}

// DELETE /api/admin/invite — remove admin by id
export async function DELETE(req: NextRequest) {
  const { lineUserId, adminId } = await req.json();
  if (!lineUserId || !adminId)
    return NextResponse.json({ error: "Missing lineUserId or adminId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("line_user_id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("account_admins")
    .delete()
    .eq("id", adminId)
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
