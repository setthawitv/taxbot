// TikTok Shop API config + request signing.
//
// Credentials come from server-side env vars (never NEXT_PUBLIC_):
//   TIKTOK_APP_KEY, TIKTOK_APP_SECRET
// Set them in .env.local (local) and Vercel → Settings → Environment Variables (prod).
//
// This module is server-only. Do not import it from client components.

import { createHmac } from "crypto";

export const TIKTOK_APP_KEY = process.env.TIKTOK_APP_KEY ?? "";
export const TIKTOK_APP_SECRET = process.env.TIKTOK_APP_SECRET ?? "";
// service_id from the app's console — used to build the seller authorization URL.
export const TIKTOK_SERVICE_ID = process.env.TIKTOK_SERVICE_ID ?? "";

// Global (non-US) TikTok Shop open API host (business APIs — require signing).
export const TIKTOK_API_BASE = "https://open-api.tiktokglobalshop.com";
// Token host (get/refresh access_token — NOT signed).
export const TIKTOK_TOKEN_BASE = "https://auth.tiktok-shops.com";
// Seller-facing authorization host.
export const TIKTOK_AUTHORIZE_URL = "https://services.tiktokshop.com/open/authorize";

// Redirect URI configured in the TikTok console — must match byte-for-byte.
export const TIKTOK_REDIRECT_URI = "https://www.vendeefinance.com/api/tiktok/callback";

/** Throws if credentials are missing — call at the top of any TikTok API route. */
export function assertTikTokConfigured() {
  if (!TIKTOK_APP_KEY || !TIKTOK_APP_SECRET) {
    throw new Error(
      "TikTok Shop not configured: set TIKTOK_APP_KEY and TIKTOK_APP_SECRET"
    );
  }
}

/**
 * Sign a TikTok Shop API request.
 *
 * Algorithm (open-api.tiktokglobalshop.com):
 *   1. Take all query params except `sign` and `access_token`.
 *   2. Sort keys alphabetically, concat as `${key}${value}`.
 *   3. Prepend the request path, e.g. "/product/202309/products/search".
 *   4. Append the raw JSON body (only for non-multipart requests).
 *   5. Wrap the whole string with the app secret on both ends.
 *   6. HMAC-SHA256 with the app secret as key; return the lowercase hex digest.
 *
 * @param path   API path beginning with "/" (no host, no query string)
 * @param query  query params (include app_key & timestamp; sign/access_token are ignored)
 * @param body   raw request body string, or "" for GET
 */
export function signRequest(
  path: string,
  query: Record<string, string | number>,
  body = ""
): string {
  const keys = Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();

  let input = path;
  for (const k of keys) input += `${k}${query[k]}`;
  input += body;
  input = `${TIKTOK_APP_SECRET}${input}${TIKTOK_APP_SECRET}`;

  return createHmac("sha256", TIKTOK_APP_SECRET).update(input).digest("hex");
}

/** Current unix timestamp in seconds (TikTok expects UTC seconds). */
export function tiktokTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// ── OAuth state (CSRF + carries the connecting user's id) ────────────────────
// The seller authorizes while logged into *their* TikTok account, so we bind the
// flow to our user by signing the id into `state` rather than trusting a cookie.

const STATE_SECRET = process.env.NEXTAUTH_SECRET ?? TIKTOK_APP_SECRET;
const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const unb64url = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export function signState(userId: string): string {
  const payload = b64url(JSON.stringify({ u: userId, t: Date.now() }));
  const sig = createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** Returns the userId if the state is valid and unexpired, else null. */
export function verifyState(state: string | null): string | null {
  if (!state || !state.includes(".")) return null;
  const [payload, sig] = state.split(".");
  const expected = createHmac("sha256", STATE_SECRET).update(payload).digest("base64url");
  if (sig !== expected) return null;
  try {
    const { u, t } = JSON.parse(unb64url(payload));
    if (typeof u !== "string" || typeof t !== "number") return null;
    if (Date.now() - t > STATE_TTL_MS) return null;
    return u;
  } catch {
    return null;
  }
}

/** Seller authorization URL to redirect the merchant to. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({ service_id: TIKTOK_SERVICE_ID, state });
  return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
}

// ── Token exchange (auth.tiktok-shops.com — no signature required) ───────────

export type TikTokToken = {
  access_token: string;
  access_token_expire_in: number;   // absolute unix seconds
  refresh_token: string;
  refresh_token_expire_in: number;  // absolute unix seconds
  open_id?: string;
  seller_name?: string;
  seller_base_region?: string;
  granted_scopes?: string[];
};

async function tokenCall(path: string, params: Record<string, string>): Promise<TikTokToken> {
  const qs = new URLSearchParams({
    app_key: TIKTOK_APP_KEY,
    app_secret: TIKTOK_APP_SECRET,
    ...params,
  });
  const res = await fetch(`${TIKTOK_TOKEN_BASE}${path}?${qs.toString()}`, {
    method: "GET",
    cache: "no-store",
  });
  const json = await res.json();
  if (json.code !== 0 || !json.data?.access_token) {
    throw new Error(`TikTok token error: ${json.code} ${json.message ?? "unknown"}`);
  }
  return json.data as TikTokToken;
}

export function exchangeCodeForToken(authCode: string): Promise<TikTokToken> {
  return tokenCall("/api/v2/token/get", {
    auth_code: authCode,
    grant_type: "authorized_code",
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TikTokToken> {
  return tokenCall("/api/v2/token/refresh", {
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

// ── Authorized shops (open-api — signed, needs the access token) ─────────────

export type TikTokShop = {
  id: string;
  name: string;
  region: string;
  seller_type?: string;
  cipher: string;
  code?: string;
};

/**
 * Signed business-API request (open-api host). Adds app_key, timestamp and
 * shop_cipher to the query, signs, and sends the access token in the header.
 * Returns the parsed JSON (caller checks `code`).
 */
export async function tiktokRequest(
  method: "GET" | "POST",
  path: string,
  accessToken: string,
  shopCipher: string,
  opts: { query?: Record<string, string | number>; body?: unknown } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const query: Record<string, string | number> = {
    app_key: TIKTOK_APP_KEY,
    timestamp: tiktokTimestamp(),
    shop_cipher: shopCipher,
    ...(opts.query ?? {}),
  };
  const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : "";
  const sign = signRequest(path, query, bodyStr);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) qs.set(k, String(v));
  qs.set("sign", sign);

  const res = await fetch(`${TIKTOK_API_BASE}${path}?${qs.toString()}`, {
    method,
    headers: { "x-tts-access-token": accessToken, "content-type": "application/json" },
    body: method === "POST" ? bodyStr : undefined,
    cache: "no-store",
  });
  return res.json();
}

export async function getAuthorizedShops(accessToken: string): Promise<TikTokShop[]> {
  const path = "/authorization/202309/shops";
  const query: Record<string, string | number> = {
    app_key: TIKTOK_APP_KEY,
    timestamp: tiktokTimestamp(),
  };
  const sign = signRequest(path, query);
  const qs = new URLSearchParams({ ...(query as Record<string, string>), sign } as Record<string, string>);
  const res = await fetch(`${TIKTOK_API_BASE}${path}?${qs.toString()}`, {
    method: "GET",
    headers: { "x-tts-access-token": accessToken, "content-type": "application/json" },
    cache: "no-store",
  });
  const json = await res.json();
  if (json.code !== 0) {
    throw new Error(`TikTok shops error: ${json.code} ${json.message ?? "unknown"}`);
  }
  return (json.data?.shops ?? []) as TikTokShop[];
}
