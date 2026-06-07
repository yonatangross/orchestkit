import { COUNTS, SITE } from "@/lib/constants";
import { SECTION_ORDER, orderedPages } from "@/lib/docs-content";

// /llms.txt — lean navigation index (kept well under the 30,000-char
// recommendation). One link per top-level section plus the machine-readable
// resource map. The exhaustive page list lives in /docs/llms.txt and the full
// content in /llms-full.txt.
export const revalidate = false;

const SECTION: Record<string, { title: string; blurb: string }> = {
	"getting-started": {
		title: "Getting Started",
		blurb: "Install OrchestKit and ship your first feature.",
	},
	foundations: {
		title: "Concepts",
		blurb: "How skills, agents, and hooks fit together.",
	},
	memory: { title: "Memory", blurb: "The 3-tier persistent knowledge graph." },
	analytics: { title: "Analytics", blurb: "Usage, cost, and session insights." },
	guides: { title: "Guides", blurb: "Task-focused how-tos." },
	cookbook: {
		title: "Cookbook",
		blurb: "End-to-end recipes for common workflows.",
	},
	skills: { title: "Skills", blurb: `Reference for all ${COUNTS.skills} skills.` },
	agents: { title: "Agents", blurb: `Reference for all ${COUNTS.agents} agents.` },
	hooks: {
		title: "Hooks",
		blurb: `Reference for all ${COUNTS.hooks} lifecycle hooks.`,
	},
	reference: { title: "Reference", blurb: "Generated component reference." },
	troubleshooting: {
		title: "Troubleshooting",
		blurb: "Fixes for common issues.",
	},
	showcase: { title: "Showcase", blurb: "What teams build with OrchestKit." },
	changelog: { title: "Changelog", blurb: "Release history." },
};

export function GET() {
	// Pick the landing page (shortest slug) for each top-level section.
	const landing = new Map<string, { url: string; depth: number }>();
	for (const page of orderedPages()) {
		const section = page.slugs[0] ?? "other";
		const current = landing.get(section);
		if (!current || page.slugs.length < current.depth) {
			landing.set(section, { url: page.url, depth: page.slugs.length });
		}
	}

	const sectionLines = SECTION_ORDER.filter((s) => landing.has(s)).map((s) => {
		const meta = SECTION[s];
		return `- [${meta?.title ?? s}](${landing.get(s)?.url}): ${meta?.blurb ?? ""}`;
	});

	const lines = [
		`# ${SITE.name}`,
		"",
		`> Free, open-source plugin for Claude Code — ${COUNTS.skills} skills, ${COUNTS.agents} agents, ${COUNTS.hooks} hooks. Install with \`${SITE.installCommand}\`.`,
		"",
		"## Documentation",
		"",
		...sectionLines,
		"",
		"## Machine-readable resources",
		"",
		"- [Full documentation, one file](/llms-full.txt)",
		"- [Full page index](/docs/llms.txt)",
		"- [OpenAPI spec](/api/openapi)",
		"- [Natural-language query (POST)](/ask)",
		"- [MCP server](/api/mcp) · [server card](/.well-known/mcp/server-card.json)",
		"- [API catalog (RFC 9727)](/.well-known/api-catalog)",
		"- [Pricing](/pricing.md)",
		"- [Authentication](/auth.md)",
		"",
	];

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
