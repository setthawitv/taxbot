import liff from "@line/liff";

let initialized = false;

export async function initLiff() {
  if (initialized) return;
  await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
  initialized = true;
}

export async function getLiffProfile() {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    return null;
  }
  return liff.getProfile();
}

export function isInLineClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return liff.isInClient();
  } catch {
    return false;
  }
}
