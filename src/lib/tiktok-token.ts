// Server-side TikTok connection helpers: load the stored token, refresh it when
// it is about to expire, and backfill the shop id/cipher (required by every
// business API call). DB-touching — keep out of client components.

import { supabaseAdmin } from "@/lib/supabase";
import { refreshAccessToken, getAuthorizedShops } from "@/lib/tiktok";

export type TikTokConn = {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  shop_id: string | null;
  shop_cipher: string | null;
  shop_name: string | null;
  region: string | null;
  access_expires_at: string | null;
};

const SELECT =
  "user_id, access_token, refresh_token, shop_id, shop_cipher, shop_name, region, access_expires_at";

export async function getTikTokConnection(userId: string): Promise<TikTokConn | null> {
  const { data } = await supabaseAdmin
    .from("platform_tokens")
    .select(SELECT)
    .eq("user_id", userId)
    .eq("platform", "tiktok")
    .maybeSingle();
  return (data as TikTokConn) ?? null;
}

/** Returns the connection, refreshing the access token if it expires within 5 min. */
export async function getValidConnection(userId: string): Promise<TikTokConn | null> {
  let conn = await getTikTokConnection(userId);
  if (!conn) return null;

  const exp = conn.access_expires_at ? new Date(conn.access_expires_at).getTime() : 0;
  if (exp - Date.now() < 5 * 60 * 1000 && conn.refresh_token) {
    try {
      const t = await refreshAccessToken(conn.refresh_token);
      await supabaseAdmin
        .from("platform_tokens")
        .update({
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          access_expires_at: new Date(t.access_token_expire_in * 1000).toISOString(),
          refresh_expires_at: new Date(t.refresh_token_expire_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("platform", "tiktok");
      conn = { ...conn, access_token: t.access_token, refresh_token: t.refresh_token };
    } catch {
      // Keep the existing token; it may still be valid.
    }
  }
  return conn;
}

/** Fetch & persist shop id + cipher when missing. Returns updated conn + any error. */
export async function ensureShopInfo(
  userId: string
): Promise<{ conn: TikTokConn | null; error?: string }> {
  const conn = await getValidConnection(userId);
  if (!conn) return { conn: null, error: "not_connected" };
  if (conn.shop_cipher && conn.shop_id) return { conn };

  try {
    const shops = await getAuthorizedShops(conn.access_token);
    const shop = shops[0];
    if (!shop) return { conn, error: "no_shops" };

    await supabaseAdmin
      .from("platform_tokens")
      .update({
        shop_id: shop.id,
        shop_cipher: shop.cipher,
        shop_name: shop.name ?? conn.shop_name,
        region: shop.region ?? conn.region,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("platform", "tiktok");

    return { conn: { ...conn, shop_id: shop.id, shop_cipher: shop.cipher } };
  } catch (e) {
    return { conn, error: (e as Error).message };
  }
}
