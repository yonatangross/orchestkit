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
	// Ship the raw .mdx sources so the Markdown-for-Agents route (app/api/md) can
	// read them at runtime on Vercel (they would otherwise be traced only as the
	// compiled MDX components, not as raw files).
	outputFileTracingIncludes: {
		"/api/md/[[...slug]]": ["./content/docs/**/*.mdx"],
	},
	// Map agent-discovery well-known paths to their route handlers. Done via
	// rewrites (rather than dot-folders under app/) so the URLs are stable and
	// independent of Next's file-router handling of "." segments.
	rewrites: async () => [
		{
			source: "/.well-known/agent-skills/index.json",
			destination: "/api/well-known/agent-skills",
		},
		{
			source: "/.well-known/api-catalog",
			destination: "/api/well-known/api-catalog",
		},
	],
	redirects: async () => [
		{
			source: "/docs",
			destination: "/docs/foundations/overview",
			permanent: false,
		},
		{
			// 301 the bare Vercel host onto the canonical brand domain (orchestkit.yonyon.ai).
			// Preview deployments (orchestkit-<hash>.vercel.app) don't match this exact host,
			// so they stay reachable; only the production alias is redirected.
			source: "/:path*",
			has: [{ type: "host", value: "orchestkit.vercel.app" }],
			destination: "https://orchestkit.yonyon.ai/:path*",
			statusCode: 301,
		},
	],
	headers: async () => [
		{
			source: "/(.*)",
			headers: [
				{
					key: "Access-Control-Allow-Origin",
					value: "https://orchestkit.yonyon.ai",
				},
				// RFC 8288 Link headers — advertise agent-discovery resources so agents
				// can find the API catalog and machine-readable docs from any response.
				{
					key: "Link",
					value: [
						'</.well-known/api-catalog>; rel="api-catalog"',
						'</llms.txt>; rel="service-doc"',
						'</.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/index"',
					].join(", "),
				},
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "X-Content-Type-Options", value: "nosniff" },
				{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
				{
					key: "Permissions-Policy",
					value: "camera=(), microphone=(), geolocation=()",
				},
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
