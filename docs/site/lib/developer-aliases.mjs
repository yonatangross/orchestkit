// Predictable URL aliases for OrchestKit's developer resources.
//
// orank's "Developer resource discoverability" check (2026-09-27 scan: "Agent
// found 3 pages by name but no recognizable developer-resource type")
// recommends predictable URLs. These are the paths an agent or a developer
// guesses first; each redirects to the existing product-titled page, so no page
// moves and no content is duplicated.
//
// Plain .mjs so next.config.mjs can import it without a TypeScript step.
// __tests__/developer-discoverability.test.ts checks every destination is a
// real page and that no source shadows a page that already exists.

/** @type {ReadonlyArray<readonly [source: string, destination: string]>} */
export const DEVELOPER_ALIASES = [
	// API docs: the OpenAPI 3.1 reference page.
	["/docs/api", "/openapi"],
	["/docs/api-reference", "/openapi"],
	["/api-docs", "/openapi"],
	["/api-reference", "/openapi"],
	// Developer portal.
	["/docs/developers", "/developers"],
	["/developer", "/developers"],
	// Plugin install and setup.
	["/install", "/docs/getting-started/installation"],
	["/docs/install", "/docs/getting-started/installation"],
	["/docs/installation", "/docs/getting-started/installation"],
	// MCP server (the transport itself stays at /mcp and /api/mcp).
	["/docs/mcp-server", "/docs/mcp"],
	// Reference indexes.
	["/docs/skills-reference", "/docs/reference/skills"],
	["/docs/agents-reference", "/docs/reference/agents"],
	["/docs/hooks-reference", "/docs/reference/hooks"],
];
