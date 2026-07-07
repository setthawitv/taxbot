import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";

async function getUser(email: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("google_email", email)
    .single();
  return data;
}

// GET — list all vendor rules for current user
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUser(session.user.email);
  if (!user) return NextResponse.json({ vendors: [] });

  const { data } = await supabaseAdmin
    .from("vendor_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("vendor_name");

  return NextResponse.json({ vendors: data ?? [] });
}

// POST — add a vendor rule
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor_name, type } = await req.json();
  if (!vendor_name || !type) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const user = await getUser(session.user.email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("vendor_rules")
    .upsert({ user_id: user.id, vendor_name: vendor_name.trim(), type }, { onConflict: "user_id,vendor_name" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ vendor: data });
}

// DELETE — remove a vendor rule by id
export async function DELETE(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  const { error } = await supabaseAdmin.from("vendor_rules").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
