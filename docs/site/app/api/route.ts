import { SITE } from "@/lib/constants";

// JSON index for the API root. Without this, a bare GET /api hits Next's default
// HTML 404 — which makes agents (and the orank "JSON error responses" probe)
// conclude "no API detected". Returning JSON here makes the API discoverable and
// keeps the surface uniformly machine-readable. Unknown sub-paths still return
// RFC 9457 problem+json via app/api/[...path].
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	return Response.json(
		{
			name: `${SITE.name} API`,
			description:
				"Public, read-only API over the OrchestKit documentation. No authentication. Errors are RFC 9457 Problem Details (application/problem+json).",
			version: "v1",
			endpoints: {
				search: `${d}/api/search?query=...&limit=10`,
				ask: `${d}/ask`,
				mcp: `${d}/api/mcp`,
				openapi: `${d}/api/openapi`,
				health: `${d}/api/health`,
			},
			discovery: {
				apiCatalog: `${d}/.well-known/api-catalog`,
				mcpServerCard: `${d}/.well-known/mcp/server-card.json`,
				agentCard: `${d}/.well-known/agent-card.json`,
				llms: `${d}/api/llms.txt`,
				auth: `${d}/auth.md`,
			},
		},
		{
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				"Cache-Control": "public, max-age=3600",
			},
		},
	);
}
