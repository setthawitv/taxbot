import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { buildUserContext, chat, CHAT_LIMITS, type ChatPlan } from "@/lib/chat";

const HISTORY_TURNS = 8; // last 8 messages (~4 turns) sent back to the model

function monthStartISO(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
}

// Resolve plan eligibility: must be Pro/Platinum and not expired.
async function resolvePlan(userId: string): Promise<
  | { ok: true; plan: ChatPlan }
  | { ok: false; status: number; error: string; locked?: boolean }
> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, plan, plan_expires_at")
    .eq("id", userId)
    .single();

  if (!user) return { ok: false, status: 404, error: "User not found" };

  const expired = !!user.plan_expires_at && new Date(user.plan_expires_at) < new Date();
  if ((user.plan !== "pro" && user.plan !== "platinum") || expired) {
    return { ok: false, status: 403, error: "ผู้ช่วย AI ใช้ได้เฉพาะแพ็กเกจ Pro และ Platinum", locked: true };
  }
  return { ok: true, plan: user.plan as ChatPlan };
}

async function monthlyUsed(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", monthStartISO());
  return count ?? 0;
}

// GET /api/chat?userId=xxx  →  history + usage
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  const planRes = await resolvePlan(userId);
  if (!planRes.ok) {
    return NextResponse.json(
      { error: planRes.error, locked: planRes.locked ?? false },
      { status: planRes.status }
    );
  }

  const { data: messages } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(100);

  return NextResponse.json({
    plan:     planRes.plan,
    used:     await monthlyUsed(userId),
    limit:    CHAT_LIMITS[planRes.plan],
    messages: messages ?? [],
  });
}

// POST /api/chat  { userId, message }
export async function POST(req: NextRequest) {
  try {
    const { userId, message, clientData } = await req.json();
    if (!userId || !message?.trim()) {
      return NextResponse.json({ error: "Missing userId or message" }, { status: 400 });
    }

    const planRes = await resolvePlan(userId);
    if (!planRes.ok) {
      return NextResponse.json(
        { error: planRes.error, locked: planRes.locked ?? false },
        { status: planRes.status }
      );
    }

    const limit = CHAT_LIMITS[planRes.plan];
    const used  = await monthlyUsed(userId);
    if (used >= limit) {
      return NextResponse.json(
        { error: `ใช้ครบโควต้าเดือนนี้แล้ว (${used}/${limit}) — รีเซ็ตต้นเดือนหน้า`, quotaExceeded: true, used, limit },
        { status: 429 }
      );
    }

    // Recent history (oldest→newest) for conversational context
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
    const { reply, model } = await chat({ plan: planRes.plan, context, history, message: message.trim() });

    // Persist both turns (user row first so quota counts it)
    await supabaseAdmin.from("chat_messages").insert([
      { user_id: userId, role: "user",      content: message.trim() },
      { user_id: userId, role: "assistant", content: reply, model },
    ]);

    return NextResponse.json({ reply, used: used + 1, limit });
  } catch (err) {
    console.error("[chat]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
