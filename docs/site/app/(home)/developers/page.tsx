import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { COUNTS, SITE } from "@/lib/constants";
import {
	StructuredData,
	organizationNode,
	personNode,
	techArticleNode,
	breadcrumbNode,
} from "@/components/structured-data";

// /developers — the developer-resource hub at a predictable, name-based URL.
// Everything listed here already exists; this page is the single index that
// search engines and agents can find for "<brand> developer resources".
export const metadata: Metadata = {
	title: "Developer Resources",
	description: `OrchestKit by Yonyon developer resources: API docs, OpenAPI spec, MCP server (hosted + Docker), SDK packages on npm and PyPI, auth and API policy.`,
	alternates: { canonical: `${SITE.domain}/developers` },
};

const RESOURCES: ReadonlyArray<{
	title: string;
	desc: string;
	href: string;
	external?: boolean;
}> = [
	{
		title: "Documentation",
		desc: `Install guides, concepts, and reference for all ${COUNTS.skills} skills, ${COUNTS.agents} agents, and ${COUNTS.hooks} hooks.`,
		href: "/docs/getting-started/installation",
	},
	{
		title: "OpenAPI specification",
		desc: "OpenAPI 3.1 description of the public, read-only docs API — search, Markdown fetch, batch, async jobs.",
		href: "/api/openapi",
	},
	{
		title: "MCP server (hosted, Streamable HTTP)",
		desc: "Connect AI agents to the docs natively. No auth. Server card at /.well-known/mcp/server-card.json.",
		href: "/api/mcp",
	},
	{
		title: "MCP server (stdio, Docker image)",
		desc: "Run locally: docker run -i --rm ghcr.io/yonatangross/orchestkit-docs-mcp — multi-arch (amd64 + arm64).",
		href: "https://github.com/yonatangross/orchestkit/pkgs/container/orchestkit-docs-mcp",
		external: true,
	},
	{
		title: "NLWeb natural-language endpoint",
		desc: "POST or GET /ask with a question; JSON or SSE streaming responses (NLWeb protocol).",
		href: "/ask?query=what+is+orchestkit",
	},
	{
		title: "Python package (PyPI)",
		desc: "orchestkit-hook-contract — typed hook I/O contract for building OrchestKit-compatible tooling in Python.",
		href: "https://pypi.org/project/orchestkit-hook-contract/",
		external: true,
	},
	{
		title: "Authentication policy",
		desc: "The API is public and anonymous-only — auth.md states it in the WorkOS auth.md shape, with RFC 9728 PRM.",
		href: "/auth.md",
	},
	{
		title: "API versioning & deprecation policy",
		desc: "Versioning scheme, RFC 8594 Deprecation/Sunset headers, and the 6-month sunset guarantee.",
		href: "/api-policy.md",
	},
	{
		title: "llms.txt",
		desc: "Machine-readable site index for AI agents — canonical description, use cases, and resource map.",
		href: "/llms.txt",
	},
	{
		title: "API catalog (RFC 9727)",
		desc: "Linkset of every discoverable API surface at /.well-known/api-catalog.",
		href: "/.well-known/api-catalog",
	},
	{
		title: "Source code (GitHub)",
		desc: "MIT-licensed monorepo: plugin source, hooks, MCP server, docs site, and CI.",
		href: "https://github.com/yonatangross/orchestkit",
		external: true,
	},
	{
		title: "MCP registry entry",
		desc: "io.github.yonatangross/orchestkit on the official Model Context Protocol registry — republished every release.",
		href: "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.yonatangross/orchestkit",
		external: true,
	},
];

export default function DevelopersPage() {
	return (
		<ContentPage
			title="OrchestKit developer resources"
			path="/developers"
			lead="Every developer-facing surface of OrchestKit by Yonyon in one place: documentation, OpenAPI spec, MCP servers, SDK packages, and the auth and API policies. All public, all free, no account required."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "OrchestKit developer resources",
						description: "OrchestKit by Yonyon developer resources: API docs, OpenAPI spec, MCP server (hosted + Docker), SDK packages on npm and PyPI, auth and API policy.",
						path: "/developers",
						datePublished: "2026-06-11",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "Developer Resources", url: `${SITE.domain}/developers` },
					]),
				]}
			/>
			<h2>Resources</h2>
			<ul>
				{RESOURCES.map((r) => (
					<li key={r.href}>
						{r.external ? (
							<a href={r.href} target="_blank" rel="noopener noreferrer">
								{r.title}
							</a>
						) : (
							<Link href={r.href}>{r.title}</Link>
						)}
						{" — "}
						{r.desc}
					</li>
				))}
			</ul>
			<h2>For AI agents</h2>
			<p>
				Agents should start at the RFC 9727 API catalog or llms.txt above. The
				docs API needs no credentials; errors use RFC 9457 Problem Details; rate
				limits are communicated via standard RateLimit headers. The same docs are
				reachable as Markdown by appending .md to any page URL.
			</p>
		</ContentPage>
	);
}
