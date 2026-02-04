import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 defaults to React 19 with concurrent features
  reactStrictMode: true,

  // Enable Turbopack for dev (default in Next.js 16)
  // turbopack: true, // Enabled via CLI: next dev --turbopack

  // Experimental features for Feb 2026
  experimental: {
    // React 19 compiler (successor to React Server Components)
    reactCompiler: true,
    // Partial Prerendering for hybrid static/dynamic rendering
    ppr: true,
    // Type-safe route params
    typedRoutes: true,
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // ESLint during builds
  eslint: {
    ignoreDuringBuilds: false,
  },

  // TypeScript strict mode
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
