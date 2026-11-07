import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  compiler: {
    // Write public/precache-manifest.json from THIS build's assets while
    // `next build` is still running. Hosts such as Vercel collect public/
    // before any post-build script runs, so generating it afterwards shipped
    // a stale (or locally built) asset list and broke offline precaching.
    runAfterProductionCompile: async ({ projectDir, distDir }) => {
      const { writePrecacheManifest } = await import("./scripts/generate-precache-manifest.mjs");
      writePrecacheManifest({ root: projectDir, distDir });
    },
  },
  // instrumentation.ts is supported natively in Next.js 15+ without any config flag
};

export default nextConfig;
