import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const lid = req.nextUrl.searchParams.get("lid");
  if (!lid) return NextResponse.json({ error: "Missing lid" }, { status: 400 });

  const { data } = await supabaseAdmin
    .from("users")
    .select("google_access_token, sheet_id, drive_folder_id")
    .eq("id", lid)
    .single();

  if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const google_connected = !!data.google_access_token;
  const sheet_url = data.sheet_id
    ? `https://docs.google.com/spreadsheets/d/${data.sheet_id}`
    : null;
  const drive_url = data.drive_folder_id
    ? `https://drive.google.com/drive/folders/${data.drive_folder_id}`
    : null;

  return NextResponse.json({ google_connected, sheet_url, drive_url });
}
