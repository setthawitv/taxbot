import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildUserContext, chat, CHAT_PLANS, type ChatPlan } from "@/lib/chat";
import { authorizeUserId } from "@/lib/auth";

const HISTORY_TURNS = 8; // last 8 messages (~4 turns) sent back to the model

// Start of the current quota window (UTC). Month = 1st; week = Monday.
function periodStartISO(period: "week" | "month"): string {
  const now = new Date();
  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  const day  = now.getUTCDay();            // 0=Sun … 6=Sat
  const back = day === 0 ? 6 : day - 1;    // days since Monday
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back)).toISOString();
}

// Everyone can chat. Expired paid plans fall back to Free; unknown → Free.
async function resolvePlan(userId: string): Promise<ChatPlan | null> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("plan, plan_expires_at")
    .eq("id", userId)
    .single();
  if (!user) return null;

  let plan = (user.plan ?? "free") as string;
  const expired = !!user.plan_expires_at && new Date(user.plan_expires_at) < new Date();
  if (expired && (plan === "eco" || plan === "pro" || plan === "platinum")) plan = "free";
  if (!(plan in CHAT_PLANS)) plan = "free";
  return plan as ChatPlan;
}

async function usedThisPeriod(userId: string, period: "week" | "month"): Promise<number> {
  const { count } = await supabaseAdmin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", periodStartISO(period));
  return count ?? 0;
}

// GET /api/chat?userId=xxx  →  history + usage
export async function GET(req: NextRequest) {
  const userId = await authorizeUserId(req.nextUrl.searchParams.get("userId"));
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plan = await resolvePlan(userId);
  if (!plan) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const cfg = CHAT_PLANS[plan];

  const { data: messages } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({
    plan,
    label:    cfg.label,
    period:   cfg.period,
    mode:     cfg.mode,
    used:     await usedThisPeriod(userId, cfg.period),
    limit:    cfg.limit,
    messages: messages ?? [],
  });
}

// POST /api/chat  { userId, message, clientData }
export async function POST(req: NextRequest) {
  try {
    const { userId: reqUserId, message, clientData } = await req.json();
    const userId = await authorizeUserId(reqUserId);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!message?.trim()) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const plan = await resolvePlan(userId);
    if (!plan) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const cfg = CHAT_PLANS[plan];

    const used = await usedThisPeriod(userId, cfg.period);
    if (used >= cfg.limit) {
      const unit = cfg.period === "week" ? "สัปดาห์" : "เดือน";
      return NextResponse.json(
        {
          error: `ใช้ครบโควต้า${unit}นี้แล้ว (${used}/${cfg.limit}) — รีเซ็ต${cfg.period === "week" ? "ต้นสัปดาห์หน้า" : "ต้นเดือนหน้า"}`,
          quotaExceeded: true, used, limit: cfg.limit, plan,
        },
        { status: 429 }
      );
    }

    const { data: recent } = await supabaseAdmin
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS);
    const history = (recent ?? [])
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const context = await buildUserContext(userId, clientData);
    const { reply, model } = await chat({ plan, context, history, message: message.trim() });

    await supabaseAdmin.from("chat_messages").insert([
      { user_id: userId, role: "user",      content: message.trim() },
      { user_id: userId, role: "assistant", content: reply, model },
    ]);

    return NextResponse.json({ reply, used: used + 1, limit: cfg.limit });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json(
      { error: "Chat failed" },
      { status: 500 }
    );
  }
}
