import liff from "@line/liff";

let initialized = false;

export async function initLiff() {
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  initialized = true;
}

/**
 * Returns the LINE profile if already authenticated (inside LINE or previously logged in).
 * Does NOT auto-redirect to login — caller decides what to do when null is returned.
 */
export async function getLiffProfile() {
  await initLiff();
  if (!liff.isLoggedIn()) {
    return null;
  }
  return liff.getProfile();
}

/**
 * Explicitly trigger LINE login (call only from a user gesture, not on mount).
 * Redirects back to the current page after login.
 */
export function triggerLiffLogin() {
  liff.login({ redirectUri: window.location.href });
}

export function isInLineClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return liff.isInClient();
  } catch {
    return false;
  }
}

export function getLiffUrl(): string {
  return `https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID}`;
}
