import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content-page";
import { SITE } from "@/lib/constants";
import {
	StructuredData,
	organizationNode,
	personNode,
	techArticleNode,
	breadcrumbNode,
} from "@/components/structured-data";

export const metadata: Metadata = {
	title: "OrchestKit MCP server",
	description:
		"OrchestKit MCP server for documentation search and Markdown fetch. Hosted Streamable HTTP at /api/mcp, or Docker stdio. No auth.",
	alternates: { canonical: `${SITE.domain}/mcp-server` },
};

export default function McpServerPage() {
	return (
		<ContentPage
			title="OrchestKit MCP server"
			path="/mcp-server"
			lead="Read-only Model Context Protocol server for OrchestKit docs. Agents search and fetch pages. They cannot mutate anything."
		>
			<StructuredData
				nodes={[
					organizationNode(),
					personNode(),
					techArticleNode({
						headline: "OrchestKit MCP server",
						description:
							"OrchestKit MCP server: hosted Streamable HTTP and Docker stdio.",
						path: "/mcp-server",
						datePublished: "2026-09-15",
					}),
					breadcrumbNode([
						{ name: "OrchestKit", url: SITE.domain },
						{ name: "OrchestKit MCP server", url: `${SITE.domain}/mcp-server` },
					]),
				]}
			/>
			<h2>Hosted (Streamable HTTP)</h2>
			<p>
				Connect at <Link href="/api/mcp">{SITE.domain}/api/mcp</Link>. The same
				transport is rewritten at <code>/mcp</code> so short URLs work. Server
				card:{" "}
				<Link href="/.well-known/mcp/server-card.json">
					/.well-known/mcp/server-card.json
				</Link>
				. This HTML page is not the transport. POST tool calls to{" "}
				<code>/api/mcp</code>, not here.
			</p>
			<h2>Local (stdio Docker)</h2>
			<p>
				<code>
					docker run -i --rm ghcr.io/yonatangross/orchestkit-docs-mcp
				</code>
			</p>
			<p>
				Registry entry:{" "}
				<code>io.github.yonatangross/orchestkit</code> on
				registry.modelcontextprotocol.io. Hub:{" "}
				<Link href="/developers">developer resources</Link>.
			</p>
		</ContentPage>
	);
}
