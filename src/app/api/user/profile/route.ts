import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { authorizeUserId } from "@/lib/auth";

// PATCH /api/user/profile — save LINE display_name + picture_url + business_name
export async function PATCH(req: NextRequest) {
  try {
    const { userId, lineUserId, displayName, pictureUrl, businessName } = await req.json();
    const resolvedId = await authorizeUserId(userId ?? lineUserId);
    if (!resolvedId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};
    if (displayName  !== undefined) updates.display_name  = displayName  ?? null;
    if (pictureUrl   !== undefined) updates.picture_url   = pictureUrl   ?? null;
    if (businessName !== undefined) updates.business_name = businessName || null;

    const { error } = await supabaseAdmin
      .from("users")
      .update(updates)
      .eq("id", resolvedId);

    if (error) return NextResponse.json({ error: "Database error" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
