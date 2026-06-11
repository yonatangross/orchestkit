import Link from "next/link";
import { SITE } from "@/lib/constants";

// Server-rendered "for AI agents" homepage section. Deliberately text-dense and
// markup-light: AI crawlers and RAG indexers read the raw HTML (no JS), so the
// agent-integration surfaces are described here in plain prose with real links —
// including the MCP registry entry (bi-directional verification) and the WebMCP
// tools that are otherwise only visible to a JS-capable browser.
const MCP_REGISTRY_URL =
	"https://registry.modelcontextprotocol.io/v0/servers?search=io.github.yonatangross/orchestkit";

export function AgentReadinessSection() {
	return (
		<section aria-labelledby="agents-heading" className="border-b border-fd-border">
			<div className="mx-auto max-w-[820px] px-7 py-14">
				<h2 id="agents-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
					Built for AI agents, too
				</h2>
				<p className="mt-3 leading-7 text-fd-muted-foreground">
					Every page on this site is agent-readable: append <code>.md</code> to any URL (or send{" "}
					<code>Accept: text/markdown</code>) for raw Markdown, start from{" "}
					<a href="/llms.txt" className="text-fd-primary underline underline-offset-2">/llms.txt</a> for
					the navigation index, or read the{" "}
					<a href="/api/openapi" className="text-fd-primary underline underline-offset-2">OpenAPI spec</a>{" "}
					for the full read-only API. No authentication, no account.
				</p>

				<h3 className="mt-7 font-semibold text-fd-foreground">MCP server</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					The OrchestKit Docs MCP server speaks Streamable HTTP at{" "}
					<code>{SITE.domain}/api/mcp</code> with two read-only tools: documentation search and
					Markdown page fetch. It is published in the{" "}
					<a href={MCP_REGISTRY_URL} className="text-fd-primary underline underline-offset-2">
						official MCP registry
					</a>{" "}
					as <code>io.github.yonatangross/orchestkit</code>, and listed on{" "}
					<a href="https://smithery.ai/servers/yonaigross/orchestkit" className="text-fd-primary underline underline-offset-2">
						Smithery
					</a>{" "}
					and{" "}
					<a href="https://mcp.so/server/orchestkit/yonaigross" className="text-fd-primary underline underline-offset-2">
						mcp.so
					</a>
					. Server card:{" "}
					<a href="/.well-known/mcp/server-card.json" className="text-fd-primary underline underline-offset-2">
						/.well-known/mcp/server-card.json
					</a>
					.
				</p>

				<h3 className="mt-6 font-semibold text-fd-foreground">NLWeb natural-language queries</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					Ask questions in plain language at the NLWeb <code>/ask</code> endpoint —{" "}
					<code>GET /ask?query=...</code> or POST a JSON body — and get ranked documentation answers
					with NLWeb <code>_meta</code>. Add <code>?streaming=true</code> for Server-Sent Events
					(start, result, complete).
				</p>

				<h3 className="mt-6 font-semibold text-fd-foreground">WebMCP in the browser</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					For in-browser agents, every page registers WebMCP tools via{" "}
					<code>navigator.modelContext</code>: <code>search_docs</code>, <code>list_skills</code>, and{" "}
					<code>get_skill</code> — the same capabilities as the remote MCP server, available without
					leaving the page.
				</p>

				<h3 className="mt-6 font-semibold text-fd-foreground">Discovery endpoints</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					Agent card at{" "}
					<a href="/.well-known/agent-card.json" className="text-fd-primary underline underline-offset-2">
						/.well-known/agent-card.json
					</a>
					, skills index at{" "}
					<a href="/.well-known/agent-skills/index.json" className="text-fd-primary underline underline-offset-2">
						/.well-known/agent-skills/index.json
					</a>
					, API catalog at{" "}
					<a href="/.well-known/api-catalog" className="text-fd-primary underline underline-offset-2">
						/.well-known/api-catalog
					</a>
					, and auth posture (none needed) at{" "}
					<a href="/auth.md" className="text-fd-primary underline underline-offset-2">/auth.md</a>. For
					hosted-search outages, see the{" "}
					<Link href="/docs/guides/ask-fallback" className="text-fd-primary underline underline-offset-2">
						ask-fallback guide
					</Link>
					.
				</p>
			</div>
		</section>
	);
}
