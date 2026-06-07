import { SITE } from "@/lib/constants";

// NLWeb Schema Feeds map — listed via the `schemamap:` directive in robots.txt.
// Enumerates the structured-data feeds an agent can ingest. See the NLWeb Schema
// Feeds spec (github.com/microsoft/NLWeb).
export const revalidate = false;

const FEEDS: Array<{ url: string; type: string; title: string }> = [
	{
		url: `${SITE.domain}/`,
		type: "schema.org/Organization",
		title: "OrchestKit entity (Organization, SoftwareApplication, FAQPage)",
	},
	{
		url: `${SITE.domain}/.well-known/agent-skills/index.json`,
		type: "agentskills.io/discovery",
		title: "Agent Skills discovery index",
	},
	{
		url: `${SITE.domain}/.well-known/api-catalog`,
		type: "rfc9727/linkset",
		title: "API catalog (RFC 9727)",
	},
	{
		url: `${SITE.domain}/.well-known/agent-card.json`,
		type: "a2a/agent-card",
		title: "A2A agent card",
	},
	{
		url: `${SITE.domain}/.well-known/mcp/server-card.json`,
		type: "mcp/server-card",
		title: "MCP server card",
	},
	{
		url: `${SITE.domain}/llms-full.txt`,
		type: "llmstxt/full",
		title: "Full documentation in one file",
	},
];

function xmlEscape(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function GET() {
	const items = FEEDS.map(
		(f) =>
			`  <feed type="${xmlEscape(f.type)}">\n    <url>${xmlEscape(f.url)}</url>\n    <title>${xmlEscape(f.title)}</title>\n  </feed>`,
	).join("\n");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<schemamap xmlns="https://schema.org/docs/schemamap">\n${items}\n</schemamap>\n`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
