import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // instrumentation.ts is supported natively in Next.js 15+ without any config flag
};

export default nextConfig;
