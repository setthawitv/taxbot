import type { NextConfig } from "next";

// Baseline security headers applied to every response. Addresses common
// pentest findings: clickjacking, MIME sniffing, referrer leakage, and
// enforces HTTPS. CSP is intentionally omitted here to avoid breaking the
// LIFF/Google embeds; add a tuned CSP later if required.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Allow sharp and pdf-lib to run in server-side API routes on Vercel
  serverExternalPackages: ["sharp", "pdf-lib", "@pdf-lib/fontkit"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
