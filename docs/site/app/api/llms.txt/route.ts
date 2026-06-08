import { SITE } from "@/lib/constants";

// /api/llms.txt — section-scoped llms.txt for the API surface. Lets an agent
// fetch focused context about the programmatic endpoints without pulling the
// whole manual (/llms.txt). A static route segment takes precedence over the
// app/api/[...path] catch-all.
export const revalidate = false;

// Shared content generator so the Markdown twin (/api/llms.txt.md) serves the
// exact same text — the only difference between the two routes is Content-Type.
export function buildLlmsTxt(): string {
	const d = SITE.domain;
	return [
		`# ${SITE.name} API`,
		"",
		`> Public, read-only HTTP API over the ${SITE.name} documentation. No authentication. Errors use the RFC 9457 Problem Details shape, served as \`application/json\`. Current version: v1.`,
		"",
		"## Endpoints",
		"",
		`- \`GET ${d}/api/search?query=...&limit=10\` — full-text docs search (JSON array; \`X-Total-Count\` header; \`limit\` paginates). Versioned alias: \`/api/v1/search\`.`,
		`- \`POST ${d}/ask\` — NLWeb natural-language query → JSON with \`_meta\`; send \`Accept: text/event-stream\` for SSE streaming.`,
		`- \`POST ${d}/api/mcp\` — MCP server (Streamable HTTP / JSON-RPC): \`initialize\`, \`tools/list\`, \`tools/call\`. Tools are read-only (\`readOnlyHint: true\`).`,
		`- \`GET ${d}/api/openapi\` — OpenAPI 3.1 description of the API.`,
		`- \`GET ${d}/api/health\` — liveness check.`,
		"",
		"## Use cases",
		"",
		"- Answer a user's natural-language question about OrchestKit (`/ask`).",
		"- Find the right documentation page before fetching its Markdown (`/api/search` → append `.md` to the page URL).",
		"- Connect an MCP-capable agent (Claude, etc.) to search docs and read pages natively (`/api/mcp`).",
		"",
		"## Constraints",
		"",
		"- Read-only: there are no write, payment, or account endpoints.",
		"- No authentication and no per-key rate limit; the API is served behind a CDN. Be a good citizen: cache responses (most carry `Cache-Control`) and back off on transient `5xx` with exponential retry (e.g. 1s, 2s, 4s).",
		"- Search is over documentation content only (not source code).",
		"",
		"## Discovery",
		"",
		`- API catalog (RFC 9727): ${d}/.well-known/api-catalog`,
		`- MCP server card: ${d}/.well-known/mcp/server-card.json`,
		`- A2A agent card: ${d}/.well-known/agent-card.json`,
		`- Auth (none): ${d}/auth.md`,
		"",
	].join("\n");
}

export function GET() {
	const body = buildLlmsTxt();

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
