import { SITE } from "@/lib/constants";

// Values for the MCP server card served by app/api/mcp/server-card/route.ts.
// Kept out of the route file because a Next.js route file may only export
// route fields.
//
// $schema is the draft server-card identifier (SEP-2127) that agent-readiness
// scanners look for. It is an identifier, not a fetch target: the draft has no
// published schema file yet, and this URL answered HTTP 404 on 2026-10-21.
// The card's fields follow the published MCP registry server.json schema
// (2025-12-11, HTTP 200 the same day). The test validates the whole card
// against a pinned copy of that schema in __tests__/fixtures/.
export const SERVER_CARD_SCHEMA =
	"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json";

// The card name is reverse DNS of the canonical host (orchestkit.dev).
export const SERVER_CARD_NAME = "dev.orchestkit/mcp";

// The schema caps the description at 100 characters (server-card.test.ts).
export const SERVER_CARD_DESCRIPTION =
	"Search and read the OrchestKit Claude Code plugin docs as Markdown over MCP.";

export function serverCard() {
	return {
		$schema: SERVER_CARD_SCHEMA,
		name: SERVER_CARD_NAME,
		title: `${SITE.name} Docs MCP`,
		description: SERVER_CARD_DESCRIPTION,
		version: SITE.version,
		websiteUrl: SITE.domain,
		repository: { url: SITE.github, source: "github" },
		remotes: [{ type: "streamable-http", url: `${SITE.domain}/api/mcp` }],
	};
}
