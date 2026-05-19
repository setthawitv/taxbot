import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// PATCH /api/user/profile — save LINE display_name + picture_url
export async function PATCH(req: NextRequest) {
  try {
    const { lineUserId, displayName, pictureUrl } = await req.json();
    if (!lineUserId) return NextResponse.json({ error: "Missing lineUserId" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("users")
      .update({
        display_name: displayName ?? null,
        picture_url:  pictureUrl  ?? null,
      })
      .eq("line_user_id", lineUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
