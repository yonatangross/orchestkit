import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";
import { DEVELOPER_RESOURCES } from "@/lib/developer-resources";
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
	// The name-based queries the audits ran ("yonyon developer resources",
	// "OrchestKit API / OpenAPI / MCP") have to have something to match in the
	// title itself, not only in the "| OrchestKit" suffix the layout template
	// appends: an agent that reads og:title or strips the site suffix would
	// otherwise see no product name at all. So the title leads with the product,
	// names the surfaces, and keeps the studio name.
	title: "OrchestKit Developer Resources by Yonyon: API, OpenAPI Spec, MCP Server",
	description: `OrchestKit by Yonyon developer resources: API docs, OpenAPI spec, MCP server (hosted + Docker), SDK packages on npm and PyPI, auth and API policy.`,
	alternates: { canonical: `${SITE.domain}/developers` },
};


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
				{DEVELOPER_RESOURCES.map((r) => (
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
				limits are communicated via standard RateLimit response headers on every
				API response. Any documentation page is reachable as raw Markdown by
				appending .md to its URL or sending Accept: text/markdown; this page has
				a Markdown twin at <Link href="/developers.md">/developers.md</Link>, and
				an unknown path returns a 404 whose body lists where to look next.
			</p>
		</ContentPage>
	);
}
