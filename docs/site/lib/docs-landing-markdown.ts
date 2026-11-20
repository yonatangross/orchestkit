import { SITE } from "@/lib/constants";
import { withFrontmatter } from "@/lib/md-frontmatter";

// Markdown bodies for the hand-authored /docs/mcp and /docs/sdk landing pages.
// These are NOT fumadocs MDX pages, so app/api/md must synthesize them when
// middleware rewrites AI-bot / Accept: text/markdown traffic to /api/md/*.

export type DocsLandingSlug = "mcp" | "sdk";

export function isDocsLandingSlug(slug: string): slug is DocsLandingSlug {
	return slug === "mcp" || slug === "sdk";
}

const MCP_TITLE = "OrchestKit MCP server";
const MCP_LEAD =
	"Read-only Model Context Protocol server for OrchestKit docs. Agents search and fetch pages. They cannot mutate anything.";

const SDK_TITLE = "OrchestKit SDK packages";
const SDK_LEAD =
	"Official clients for the public OrchestKit docs API. Each package homepage is this domain so agents can verify they are ours.";

function mcpMarkdown(): string {
	return [
		`# ${MCP_TITLE}`,
		"",
		`> ${MCP_LEAD}`,
		"",
		"## Hosted (Streamable HTTP)",
		"",
		`Connect at ${SITE.domain}/api/mcp (also rewritten at /mcp). Server card: ${SITE.domain}/.well-known/mcp/server-card.json.`,
		"This page is not the transport. POST tool calls to /api/mcp.",
		"",
		"## Local (stdio Docker)",
		"",
		"```",
		"docker run -i ghcr.io/yonatangross/orchestkit-docs-mcp",
		"```",
		"",
		`Registry entry: io.github.yonatangross/orchestkit on registry.modelcontextprotocol.io. Hub: ${SITE.domain}/developers.`,
		"",
	].join("\n");
}

function sdkMarkdown(): string {
	return [
		`# ${SDK_TITLE}`,
		"",
		`> ${SDK_LEAD}`,
		"",
		"## npm",
		"",
		`Package orchestkit: CLI and library (search, ask, read). https://registry.npmjs.org/orchestkit. Homepage ${SITE.domain}/developers.`,
		"",
		"## PyPI",
		"",
		"Package orchestkit: the same docs API client in Python. https://pypi.org/project/orchestkit/.",
		"Hook event schemas remain https://pypi.org/project/orchestkit-hook-contract/.",
		"",
		"## Go",
		"",
		"Module github.com/yonatangross/orchestkit/sdk. `go get github.com/yonatangross/orchestkit/sdk`.",
		"Source: https://github.com/yonatangross/orchestkit/tree/main/sdk.",
		"pkg.go.dev is not published for this path yet.",
		"",
		`OpenAPI for codegen: ${SITE.domain}/openapi. Hub: ${SITE.domain}/developers.`,
		"",
	].join("\n");
}

const RENDERERS: Record<DocsLandingSlug, () => string> = {
	mcp: mcpMarkdown,
	sdk: sdkMarkdown,
};

const FRONTMATTER: Record<
	DocsLandingSlug,
	{ title: string; description: string; canonical: string }
> = {
	mcp: {
		title: MCP_TITLE,
		description: MCP_LEAD,
		canonical: `${SITE.domain}/docs/mcp`,
	},
	sdk: {
		title: SDK_TITLE,
		description: SDK_LEAD,
		canonical: `${SITE.domain}/docs/sdk`,
	},
};

export function docsLandingMarkdown(slug: DocsLandingSlug): string {
	return withFrontmatter(FRONTMATTER[slug], RENDERERS[slug]());
}
