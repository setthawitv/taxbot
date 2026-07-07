import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// GET /api/admin/invite?userId=xxx  — list all admins for owner
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lineUserId = await authorizeUserId(sp.get("userId") ?? sp.get("lineUserId"));
  if (!lineUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
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
  const body = await req.json();
  const { adminEmail } = body;
  const lineUserId = await authorizeUserId(body.userId ?? body.lineUserId);
  if (!lineUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminEmail)
    return NextResponse.json({ error: "Missing adminEmail" }, { status: 400 });

  const email = adminEmail.trim().toLowerCase();

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
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

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ invite });
}

// DELETE /api/admin/invite — remove admin by id
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { adminId } = body;
  const lineUserId = await authorizeUserId(body.userId ?? body.lineUserId);
  if (!lineUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!adminId)
    return NextResponse.json({ error: "Missing adminId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("account_admins")
    .delete()
    .eq("id", adminId)
    .eq("owner_user_id", user.id);

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
