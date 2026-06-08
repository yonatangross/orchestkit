import { COUNTS, SITE } from "@/lib/constants";

// MCP server card — served at /.well-known/mcp/server-card.json (and /.well-known/mcp)
// via rewrites in next.config.mjs. Lets an agent preview the server before
// opening a transport connection. Points at the real Streamable HTTP server at
// /api/mcp.
export const revalidate = false;

export function GET() {
	const d = SITE.domain;
	const card = {
		name: `${SITE.name} Docs MCP`,
		description: `Model Context Protocol server for the ${SITE.name} documentation (${COUNTS.skills} skills, ${COUNTS.agents} agents). Search the docs and fetch pages as Markdown.`,
		version: SITE.version,
		serverUrl: `${d}/api/mcp`,
		transport: "streamable-http",
		authentication: { type: "none" },
		// Branding for registry listings (logo + category).
		icon: `${d}/favicon.svg`,
		logo: `${d}/favicon.svg`,
		category: "developer-tools",
		homepage: d,
		repository: SITE.github,
		license: "MIT",
		tools: [
			{
				name: "orchestkit_docs_search",
				description:
					"Search the OrchestKit documentation; returns ranked pages with titles and URLs.",
				annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
			},
			{
				name: "orchestkit_docs_get",
				description:
					"Fetch one OrchestKit documentation page as Markdown by its path.",
				annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
			},
		],
	};

	return new Response(JSON.stringify(card, null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
