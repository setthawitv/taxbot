import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Generate a short alphanumeric invite code
function genCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ── GET /api/staff/invite?userId=xxx ─────────────────────────────────────────
// Returns the owner's current active invite (creates one if none exists)
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const lineUserId = sp.get("userId") ?? sp.get("lineUserId");
  if (!lineUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get existing active invite
  const { data: existing } = await supabaseAdmin
    .from("staff_invites")
    .select("*")
    .eq("owner_user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing) return NextResponse.json({ invite: existing });

  // Create new invite
  const code = genCode();
  const { data: created, error } = await supabaseAdmin
    .from("staff_invites")
    .insert({ owner_user_id: user.id, code, label: "Staff" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: created });
}

// ── POST /api/staff/invite — reset (deactivate old + create new) ─────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineUserId = body.userId ?? body.lineUserId;
  if (!lineUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Deactivate all existing invites
  await supabaseAdmin
    .from("staff_invites")
    .update({ is_active: false })
    .eq("owner_user_id", user.id);

  // Create fresh invite
  const code = genCode();
  const { data: created, error } = await supabaseAdmin
    .from("staff_invites")
    .insert({ owner_user_id: user.id, code, label: "Staff" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invite: created });
}

// ── DELETE /api/staff/invite — disable invite ────────────────────────────────
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const lineUserId = body.userId ?? body.lineUserId;
  if (!lineUserId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const { data: user } = await supabaseAdmin
    .from("users").select("id").eq("id", lineUserId).single();
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await supabaseAdmin
    .from("staff_invites")
    .update({ is_active: false })
    .eq("owner_user_id", user.id);

  return NextResponse.json({ ok: true });
}
