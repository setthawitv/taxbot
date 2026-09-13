import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Keep-alive ping: runs a tiny query so the Supabase project never idles into
// its inactivity auto-pause (which makes the first visit slow / show empty
// data). Triggered by Vercel Cron; also safe to hit from an external uptime
// pinger (e.g. every 5 min) for an always-warm DB.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    // Cheapest possible touch: HEAD count on one row.
    const { error } = await supabaseAdmin
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, ms: Date.now() - startedAt });
  } catch (e) {
    return NextResponse.json(
      { ok: false, ms: Date.now() - startedAt, error: (e as Error).message },
      { status: 500 },
    );
  }
}
