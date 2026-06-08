import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId") ?? req.nextUrl.searchParams.get("lineUserId");
  if (!userId) {
    return NextResponse.json({ connected: false, onboarded: false });
  }

  const { data } = await supabaseAdmin
    .from("users")
    .select(
      "google_access_token, google_email, business_name, first_name, last_name, business_type, phone, vat_registered, display_name, picture_url"
    )
    .eq("id", userId)
    .single();

  if (!data) {
    return NextResponse.json({ connected: false, onboarded: false });
  }

  // User is considered "fully onboarded" when they have completed at least
  // step 2 (business setup) — Google connect can be done later from settings.
  const onboarded = !!data.business_name;

  return NextResponse.json({
    connected:    !!data.google_access_token,
    email:        data.google_email  ?? null,
    displayName:  data.display_name  ?? null,
    pictureUrl:   data.picture_url   ?? null,
    onboarded,
    profile: {
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
      businessName: data.business_name ?? "",
      businessType: data.business_type ?? "individual",
      phone: data.phone ?? "",
      vatRegistered: data.vat_registered ?? false,
    },
  });
}
