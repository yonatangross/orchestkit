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
		// /llms-full.txt concatenates every doc body at request time.
		"/llms-full.txt": ["./content/docs/**/*.mdx"],
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
		{
			// A2A agent card.
			source: "/.well-known/agent-card.json",
			destination: "/api/well-known/agent-card",
		},
		{
			// MCP server card (both the bare path and the spec-named JSON file).
			source: "/.well-known/mcp",
			destination: "/api/well-known/mcp-server-card",
		},
		{
			source: "/.well-known/mcp/server-card.json",
			destination: "/api/well-known/mcp-server-card",
		},
		{
			// Alternate well-known filenames agents probe for the server card.
			source: "/.well-known/mcp.json",
			destination: "/api/well-known/mcp-server-card",
		},
		{
			source: "/.well-known/mcp/manifest.json",
			destination: "/api/well-known/mcp-server-card",
		},
		{
			source: "/mcp.json",
			destination: "/api/well-known/mcp-server-card",
		},
		{
			// RFC 9728 Protected Resource Metadata — anonymous-only signal (the
			// API has no auth; this says so in spec shape instead of a 404).
			source: "/.well-known/oauth-protected-resource",
			destination: "/api/well-known/oauth-protected-resource",
		},
		{
			// NLWeb natural-language query endpoint.
			source: "/ask",
			destination: "/api/ask",
		},
		{
			// WebMCP: expose the MCP server at the bare /mcp path so it's
			// browser-discoverable (the /.well-known/mcp server-card is separate).
			source: "/mcp",
			destination: "/api/mcp",
		},
		{
			// Path-versioned API alias: /api/v1/* → /api/* (this is API v1).
			source: "/api/v1/:path*",
			destination: "/api/:path*",
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
				// Public, read-only site + agent API: allow any origin so
				// cross-origin (incl. browser-based) AI agents can actually read
				// /ask, /api/mcp, the well-known cards, and the markdown/llms feeds.
				// Locking this to the apex blocked every cross-origin agent.
				{ key: "Access-Control-Allow-Origin", value: "*" },
				{
					key: "Access-Control-Allow-Methods",
					value: "GET, POST, OPTIONS",
				},
				{
					key: "Access-Control-Allow-Headers",
					value: "Content-Type, Accept",
				},
				// RFC 8288 Link headers — advertise agent-discovery resources so agents
				// can find the API catalog and machine-readable docs from any response.
				{
					key: "Link",
					value: [
						'</.well-known/api-catalog>; rel="api-catalog"',
						'</llms.txt>; rel="service-doc"',
						'</.well-known/agent-skills/index.json>; rel="https://agentskills.io/rel/index"',
						'</.well-known/agent-card.json>; rel="https://a2a.dev/rel/agent-card"',
						'</.well-known/mcp/server-card.json>; rel="https://modelcontextprotocol.io/rel/server-card"',
						'</api-policy.md>; rel="deprecation"',
					].join(", "),
				},
				// Vary on Accept: the same URL serves HTML or Markdown depending on the
				// Accept header (see middleware.ts), so caches must key on it.
				{ key: "Vary", value: "Accept, Accept-Encoding" },
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
