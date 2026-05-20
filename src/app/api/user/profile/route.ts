import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PATCH /api/user/profile — save LINE display_name + picture_url + business_name
export async function PATCH(req: NextRequest) {
  try {
    const { lineUserId, displayName, pictureUrl, businessName } = await req.json();
    if (!lineUserId) return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (displayName  !== undefined) updates.display_name  = displayName  ?? null;
    if (pictureUrl   !== undefined) updates.picture_url   = pictureUrl   ?? null;
    if (businessName !== undefined) updates.business_name = businessName || null;

    const { error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("line_user_id", lineUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
