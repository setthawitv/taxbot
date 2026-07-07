// Server-side authorization helpers.
//
// The API used to trust a client-supplied `userId`, letting anyone read or
// mutate another account's data (BOLA / IDOR). These helpers derive the
// caller's identity from the authenticated NextAuth (Google) session and
// enforce that a requested userId actually belongs to the caller — either as
// the account owner, or as an accepted admin of that account.

import { getServerSession } from "next-auth";
import { supabaseAdmin } from "@/lib/supabase";

/** The authenticated Google email of the current session (lowercased), or null. */
export async function getSessionEmail(): Promise<string | null> {
  const session = await getServerSession();
  return session?.user?.email?.toLowerCase().trim() ?? null;
}

/**
 * The set of user IDs the current session is allowed to act on:
 * the caller's own account plus any accounts they are an accepted admin of.
 * Returns null when there is no valid session / no matching user.
 */
export async function getAuthorizedUserIds(): Promise<Set<string> | null> {
  const session = await getServerSession();
  const email = session?.user?.email?.toLowerCase().trim();
  if (!email) return null;

  const ids = new Set<string>();

  const { data: owner } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("google_email", email)
    .single();
  if (owner?.id) ids.add(owner.id);

  const { data: admins } = await supabaseAdmin
    .from("account_admins")
    .select("owner_user_id")
    .eq("admin_email", email)
    .eq("status", "accepted");
  for (const a of admins ?? []) if (a.owner_user_id) ids.add(a.owner_user_id);

  return ids.size ? ids : null;
}

/**
 * Authorize access to a specific account.
 *
 * - No session / unknown user → null (caller should return 401).
 * - `requested` omitted → the caller's own (first authorized) id.
 * - `requested` provided → returned only if the caller is authorized for it,
 *   otherwise null (caller should return 401/403).
 */
export async function authorizeUserId(
  requested?: string | null
): Promise<string | null> {
  const ids = await getAuthorizedUserIds();
  if (!ids) return null;
  if (!requested) return ids.values().next().value ?? null;
  return ids.has(requested) ? requested : null;
}
