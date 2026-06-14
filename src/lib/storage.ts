// Client-side storage helpers with backward-compatible key migration.
//
// The app was formerly branded "TaxBot" and persisted browser state under a
// `taxbot_` key prefix. After the rebrand to "Vendee" we write `vendee_`-prefixed
// keys, but still read the legacy `taxbot_` keys so existing users keep their
// saved state (onboarding flag, tax deductions, selected period, etc.).
//
// Pass the un-prefixed name (e.g. "year", `deductions_${year}`) — these helpers
// add the prefix.

const NEW_PREFIX = "vendee_";
const OLD_PREFIX = "taxbot_";

/**
 * Read a localStorage value, preferring the new `vendee_` key and falling back
 * to the legacy `taxbot_` key. When only the legacy key exists it is migrated
 * forward (copied to the new key) so the fallback is paid at most once.
 * Returns null if neither key is set.
 */
export function lsGet(name: string): string | null {
  if (typeof window === "undefined") return null;
  const newKey = NEW_PREFIX + name;
  const current = localStorage.getItem(newKey);
  if (current !== null) return current;
  const legacy = localStorage.getItem(OLD_PREFIX + name);
  if (legacy !== null) {
    try { localStorage.setItem(newKey, legacy); } catch {}
    return legacy;
  }
  return null;
}

/** Write a localStorage value under the new `vendee_` key. */
export function lsSet(name: string, value: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(NEW_PREFIX + name, value);
}

/** Remove a value under both the new and legacy key prefixes. */
export function lsRemove(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NEW_PREFIX + name);
  localStorage.removeItem(OLD_PREFIX + name);
}

// ── Cookies ──────────────────────────────────────────────────────────────────

/**
 * Read a cookie by un-prefixed name, preferring `vendee_` over the legacy
 * `taxbot_` cookie. Client-side only (uses document.cookie).
 */
export function cookieGet(name: string): string | null {
  if (typeof document === "undefined") return null;
  const read = (key: string) =>
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(key + "="))
      ?.split("=")[1] ?? null;
  return read(NEW_PREFIX + name) ?? read(OLD_PREFIX + name);
}

/** Set a cookie under the new `vendee_` key. */
export function cookieSet(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${NEW_PREFIX + name}=${value}; path=/; max-age=${maxAgeSeconds}`;
}

/** Clear a cookie under both the new and legacy key prefixes. */
export function cookieClear(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${NEW_PREFIX + name}=; path=/; max-age=0`;
  document.cookie = `${OLD_PREFIX + name}=; path=/; max-age=0`;
}
