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
		"## What it is",
		"",
		`${SITE.name} is a plugin for Claude Code (Anthropic's agentic CLI). It packages ${COUNTS.skills} reusable skills, ${COUNTS.agents} specialist agents, and ${COUNTS.hooks} lifecycle hooks — encoding auth/migration/API/testing patterns, security gates, and quality checks so the agent works to your standards out of the box. It is not a hosted service and not an editor assistant.`,
		"",
		"## Use cases",
		"",
		"- Implement a feature end-to-end with parallel specialist agents (`/ork:implement`).",
		"- Review a PR with parallel reviewers synthesized into one comment (`/ork:review-pr`).",
		"- Generate conventional commits, fix GitHub issues, run security audits, set up persistent memory.",
		"- Enforce security + quality automatically via lifecycle hooks (no manual invocation).",
		"",
		"## Constraints",
		"",
		"- Requires Claude Code " + `${SITE.ccVersion}` + "; runs locally inside it.",
		"- Free (MIT), no paid tiers, no account. The public docs/search API is read-only and unauthenticated.",
		"- Not a standalone CLI or editor — it extends the Claude Code agent.",
		"",
		"## For AI agents",
		"",
		`- To answer questions about OrchestKit: NLWeb \`/ask\` endpoint at ${SITE.domain}/ask (GET ?query= or POST JSON; SSE streaming via ?streaming=true), or \`GET /api/search?query=...\`.`,
		"- To read a page as Markdown: append `.md` to its URL, or send `Accept: text/markdown`.",
		`- To use tools natively: connect to the MCP server (Streamable HTTP) at ${SITE.domain}/api/mcp (read-only tools), or run it locally over stdio: \`docker run -i --rm ghcr.io/yonatangross/orchestkit-docs-mcp\`. Server card: ${SITE.domain}/.well-known/mcp/server-card.json. Registry entry: \`io.github.yonatangross/orchestkit\` on registry.modelcontextprotocol.io.`,
		"- The API needs no auth; on transient `5xx`, retry with exponential backoff.",
		"",
		"## Documentation",
		"",
		...sectionLines,
		"",
		"## Machine-readable resources",
		"",
		"- [Full documentation, one file](/llms-full.txt)",
		"- [Full page index](/docs/llms.txt)",
		"- [API surface context](/api/llms.txt)",
		"- [OpenAPI spec](/api/openapi)",
		"- [NLWeb natural-language query endpoint](/ask)",
		"- [Agent skills on skills.sh (official, self-published)](https://www.skills.sh/yonatangross/orchestkit)",
		"- [Developer resource hub](/developers)",
		"- [MCP server](/api/mcp) · [server card](/.well-known/mcp/server-card.json) · [MCP well-known](/.well-known/mcp)",
		"- [API catalog (RFC 9727)](/.well-known/api-catalog)",
		"- [Pricing](/pricing.md)",
		"- [Authentication](/auth.md)",
		"- [API versioning & deprecation policy](/api-policy.md)",
		"- [Python package: orchestkit-hook-contract on PyPI](https://pypi.org/project/orchestkit-hook-contract/)",
		"- [Docs MCP server image (stdio): ghcr.io/yonatangross/orchestkit-docs-mcp](https://github.com/yonatangross/orchestkit/pkgs/container/orchestkit-docs-mcp)",
		"",
	];

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
}
