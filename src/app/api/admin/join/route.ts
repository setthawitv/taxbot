import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/admin/join  { inviteCode }
// Called after admin signs in with Google — links their email to the owner account
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "กรุณาลงชื่อเข้าใช้ด้วย Google ก่อน" }, { status: 401 });
  }

  const { inviteCode } = await req.json();
  if (!inviteCode) return NextResponse.json({ error: "Missing inviteCode" }, { status: 400 });

  const email = session.user.email.toLowerCase().trim();

  // Find the invite
  const { data: invite, error: findErr } = await supabaseAdmin
    .from("account_admins")
    .select("id, owner_user_id, admin_email, status")
    .eq("invite_code", inviteCode)
    .single();

  if (findErr || !invite) {
    return NextResponse.json({ error: "ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว" }, { status: 404 });
  }

  if (invite.status === "accepted") {
    return NextResponse.json({ ok: true, alreadyAccepted: true });
  }

  // Verify the email matches
  if (invite.admin_email.toLowerCase() !== email) {
    return NextResponse.json(
      { error: `ลิงก์นี้ถูกส่งให้ ${invite.admin_email} — กรุณาลงชื่อเข้าใช้ด้วยบัญชีนั้น` },
      { status: 403 }
    );
  }

  // Accept invite — also store admin_name from Google session
  const { error: updateErr } = await supabaseAdmin
    .from("account_admins")
    .update({
      status:     "accepted",
      admin_name: session.user.name ?? email,
    })
    .eq("id", invite.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// GET /api/admin/join?code=xxx  — verify invite before signing in (show owner info)
export async function GET(req: NextRequest) {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "Missing code" }, { status: 400 });

  const { data: invite } = await supabaseAdmin
    .from("account_admins")
    .select("admin_email, status, owner_user_id")
    .eq("invite_code", code)
    .single();

  if (!invite) return NextResponse.json({ error: "ไม่พบลิงก์เชิญนี้" }, { status: 404 });

  // Get owner name
  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("display_name, business_name")
    .eq("id", invite.owner_user_id)
    .single();

  return NextResponse.json({
    adminEmail:  invite.admin_email,
    status:      invite.status,
    ownerName:   owner?.business_name ?? owner?.display_name ?? "เจ้าของบัญชี",
  });
}
