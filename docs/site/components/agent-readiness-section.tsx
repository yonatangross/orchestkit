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
					the navigation index, or follow the named pages below for the OpenAPI spec, MCP server, and
					SDK packages. No authentication, no account.
				</p>

				<h3 className="mt-7 font-semibold text-fd-foreground">OrchestKit OpenAPI specification</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					Human page:{" "}
					<Link href="/openapi" className="text-fd-primary underline underline-offset-2">
						/openapi
					</Link>
					. Machine spec:{" "}
					<a href="/api/openapi" className="text-fd-primary underline underline-offset-2">OpenAPI spec</a>{" "}
					at /openapi.json for the full read-only API. No authentication, no account.
				</p>

				<h3 className="mt-7 font-semibold text-fd-foreground">OrchestKit MCP server</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					Human page:{" "}
					<Link href="/mcp-server" className="text-fd-primary underline underline-offset-2">
						/mcp-server
					</Link>
					. The OrchestKit MCP server speaks Streamable HTTP at{" "}
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

				<h3 className="mt-6 font-semibold text-fd-foreground">OrchestKit SDK packages</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					Official clients are listed at{" "}
					<Link href="/sdk" className="text-fd-primary underline underline-offset-2">
						/sdk
					</Link>
					: npm <code>orchestkit</code>, PyPI <code>orchestkit</code>, and Go{" "}
					<code>github.com/yonatangross/orchestkit/sdk</code>.
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
					For in-browser agents, every page registers WebMCP tools on load via{" "}
					<code>document.modelContext.registerTool()</code> (with <code>navigator.modelContext</code> as
					the trailing fallback): <code>search_docs</code>, <code>get_page</code>,{" "}
					<code>list_skills</code>, and <code>get_skill</code>, the same capabilities as the remote MCP
					server, available without leaving the page. The homepage also carries a declarative{" "}
					<code>&lt;form toolname=&quot;search_docs&quot;&gt;</code> so the tool surface is visible in
					server-rendered HTML.
				</p>

				<h3 className="mt-6 font-semibold text-fd-foreground">Agent skills directory</h3>
				<p className="mt-1 leading-7 text-fd-muted-foreground">
					All OrchestKit skills are self-published on{" "}
					<a href="https://www.skills.sh/yonatangross/orchestkit" className="text-fd-primary underline underline-offset-2">
						skills.sh
					</a>{" "}
					straight from this repository — install any of them with{" "}
					<code>npx skills add yonatangross/orchestkit</code>.
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
