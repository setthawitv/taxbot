import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow sharp and pdf-lib to run in server-side API routes on Vercel
  serverExternalPackages: ["sharp", "pdf-lib", "@pdf-lib/fontkit"],
};

export default nextConfig;
