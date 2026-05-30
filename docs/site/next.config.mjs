import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/images/**" },
    ],
  },
  redirects: async () => [
    {
      source: "/docs",
      destination: "/docs/foundations/overview",
      permanent: false,
    },
  ],
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "https://orchestkit.vercel.app" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            // 'unsafe-eval' only in dev — Turbopack/React dev mode needs eval();
            // production stays strict (no eval, React never uses it in prod).
            `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            `connect-src 'self' https:${process.env.NODE_ENV === "development" ? " http://localhost:4747" : ""}`,
            "media-src 'self' https://cdn.sanity.io",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
  ],
};

export default withMDX(config);
