import { COUNTS } from "@/lib/constants";

// "Built for AI agents, too": look 05, Scoreboard with proof (picked 15.11.2026,
// KB 3a1198ac). The approved design is components/approved-design/agents-block-look05.html;
// compare against it, never against a re-draw.
//
// Server-rendered first. AI crawlers and RAG indexers read the raw HTML with no
// JS, so every surface, its link, its proof and its check date are text in the
// ordered list below. The ring is the only drawing: a static SVG with
// aria-hidden, so the list reads the same without it. Nothing sits in an
// accordion, tab or details element.
//
// Facts: desks/conductor-orchestkit-15/SEO-AEO-GEO-STATUS-1115.md and the
// mockup's data, each checked live or on main on 15 Nov 2026 (the two rows the
// mockup marked CLAIMED, the MCP registry listing and skills.sh, were read live
// that day too). A row that can no longer be checked comes out, it does not stay
// as a claim. Counts in the proof text are as of that date.

const CHECKED = "checked 15 Nov 2026";

type Surface = { name: string; path: string; href?: string; proof: string };

const SURFACES: readonly Surface[] = [
	{ name: "llms.txt", path: "/llms.txt", href: "/llms.txt", proof: "Navigation index, 89 lines, live 200" },
	{ name: "llms-full.txt", path: "/llms-full.txt", href: "/llms-full.txt", proof: "Every doc in one file, 4,155 lines" },
	{
		name: "Markdown for every page",
		path: "/docs/getting-started.md",
		href: "/docs/getting-started.md",
		proof: "Append .md or send Accept: text/markdown",
	},
	{ name: "NLWeb questions", path: "/ask?query=...", href: "/ask", proof: "Ranked answers, ?streaming=true for SSE" },
	{
		name: "Sitemap",
		path: "/sitemap.xml",
		href: "/sitemap.xml",
		proof: "352 URLs (one GET, 15 Nov 2026 12:13), 153 of them under /docs/reference/skills/",
	},
	{
		name: "Structured data",
		path: "/",
		href: "/",
		proof: "SoftwareApplication, Organization, WebSite with SearchAction, FAQPage",
	},
	{ name: "MCP server", path: "/api/mcp", href: "/api/mcp", proof: "Streamable HTTP, two read-only tools" },
	{ name: "Actions MCP", path: "/api/mcp/actions", href: "/api/mcp/actions", proof: "Second MCP endpoint for actions" },
	{ name: "WebMCP in the browser", path: "/", href: "/", proof: "search_docs and get_page registered on every page" },
	{ name: "OpenAPI spec", path: "/api/openapi", href: "/api/openapi", proof: "Read-only API description" },
	{
		name: "robots.txt AI rules",
		path: "/robots.txt",
		href: "/robots.txt",
		proof: "11 named AI bots allowed, CCBot and Bytespider blocked",
	},
	{
		name: "Agent card and catalogs",
		path: "/.well-known/agent-card.json",
		href: "/.well-known/agent-card.json",
		proof: "Plus agent-skills, api-catalog and MCP server cards, linked from a Link header",
	},
	{
		name: "MCP registry listing",
		path: "io.github.yonatangross/orchestkit",
		href: "https://registry.modelcontextprotocol.io/v0/servers?search=io.github.yonatangross/orchestkit",
		proof: "Listed in the official MCP registry",
	},
	{
		name: "skills.sh",
		path: "npx skills add yonatangross/orchestkit",
		href: "https://www.skills.sh/yonatangross/orchestkit",
		proof: "Self-published from this repository",
	},
];

/**
 * A code path that may wrap after each "/" and "." but never mid-segment:
 * with overflow-wrap alone, "https://orchestkit.dev/api/mcp" split as
 * "api/m" + "cp" at 390 (QA N11). Exported for the unit test.
 */
export function Path({ text }: { text: string }) {
	const parts = text.split(/(?<=[/.])/);
	return (
		<code>
			{parts.map((part, i) => (
				// Segments can repeat and never reorder, so the index keys them.
				<span key={i}>
					{part}
					{i < parts.length - 1 ? <wbr /> : null}
				</span>
			))}
		</code>
	);
}

/** The drawing: a ring that counts the checked surfaces. Static SVG, decoration only. */
function ScoreRing({ checked, total }: { checked: number; total: number }) {
	const r = 34;
	const c = 2 * Math.PI * r;
	const len = (c * checked) / total;
	return (
		<svg viewBox="0 0 84 84" aria-hidden="true" className="size-[84px] flex-none">
			<circle cx="42" cy="42" r={r} fill="none" strokeWidth="9" className="stroke-fd-muted" />
			<circle
				cx="42"
				cy="42"
				r={r}
				fill="none"
				strokeWidth="9"
				strokeDasharray={`${(len - (checked < total ? 3 : 0)).toFixed(1)} ${(c - len + (checked < total ? 3 : 0)).toFixed(1)}`}
				transform="rotate(-90 42 42)"
				className="stroke-emerald-600 dark:stroke-emerald-300"
			/>
			<text x="42" y="47" textAnchor="middle" fontSize="17" fontWeight="700" className="fill-fd-foreground">
				{checked}/{total}
			</text>
		</svg>
	);
}

const TAG =
	"inline-block whitespace-nowrap rounded-[5px] bg-emerald-100 px-1.5 align-[1px] text-[10.5px] font-bold tracking-[0.04em] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";

export function AgentReadinessSection() {
	const total = SURFACES.length;
	return (
		<section aria-labelledby="agents-heading" className="border-b border-fd-border">
			{/* Long code paths wrap at / and . through <Path>; overflow-wrap:anywhere
			    stays as the last resort (overflow bisect, 2026-09-25). */}
			<div className="mx-auto max-w-[820px] px-7 py-14 [&_code]:[overflow-wrap:anywhere]">
				<h2 id="agents-heading" className="text-2xl font-semibold tracking-tight text-fd-foreground">
					Built for AI agents, too
				</h2>
				<p className="mt-2 max-w-[72ch] leading-7 text-fd-muted-foreground">
					OrchestKit is a free, open-source library of {COUNTS.skills} skills, {COUNTS.agents} agents and{" "}
					{COUNTS.hooks} hooks. Skills and agents work in Claude Code, Codex, Cursor and other harnesses;
					hooks currently need Claude Code. Everything below is how an agent reads, searches and calls this
					site, with how we know it is live.
				</p>

				<div className="mt-4 flex items-center gap-[18px]">
					<ScoreRing checked={total} total={total} />
					<p className="m-0 text-[15px] text-fd-foreground">
						<strong className="text-[22px]">{total} agent surfaces.</strong> {total} checked live or on main
						on 15 Nov 2026.
					</p>
				</div>

				<ol className="mt-3 grid list-none grid-cols-1 gap-x-[26px] p-0 md:grid-cols-2">
					{SURFACES.map((s) => (
						<li
							key={s.name}
							className="grid grid-cols-[22px_minmax(0,1fr)] gap-x-2 gap-y-1 border-b border-fd-border py-[9px]"
						>
							<span
								aria-hidden="true"
								className="row-span-2 grid size-5 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
							>
								&#10003;
							</span>
							<span className="font-semibold text-fd-foreground">
								{s.name} <span className={TAG}>{CHECKED}</span>
							</span>
							<span className="text-[13px] text-fd-muted-foreground">
								{s.href ? (
									<a href={s.href} className="text-fd-primary underline underline-offset-2">
										<Path text={s.path} />
									</a>
								) : (
									<Path text={s.path} />
								)}
								. {s.proof}.
							</span>
						</li>
					))}
				</ol>

				{/* Crawl paths from the earlier prose block, kept as one plain line (oc20
				    ruling 15.11.2026, orank Discovery): agents and indexers follow these. */}
				<p className="mt-3 text-[13px] leading-6 text-fd-muted-foreground">
					Also for agents:{" "}
					<a href="/docs/sdk" className="text-fd-primary underline underline-offset-2">SDK packages</a>
					{" · listed on "}
					<a href="https://smithery.ai/servers/yonaigross/orchestkit" className="text-fd-primary underline underline-offset-2">
						Smithery
					</a>
					{" and "}
					<a href="https://mcp.so/server/orchestkit/yonaigross" className="text-fd-primary underline underline-offset-2">
						mcp.so
					</a>
					{" · auth posture (none needed): "}
					<a href="/auth.md" className="text-fd-primary underline underline-offset-2">/auth.md</a>
					{" · "}
					<a href="/docs/guides/ask-fallback" className="text-fd-primary underline underline-offset-2">
						ask-fallback guide
					</a>
					{" · WebMCP: the home page carries a declarative "}
					<code>&lt;form toolname=&quot;search_docs&quot;&gt;</code>.
				</p>

				<p className="mt-2.5 text-xs text-fd-muted-foreground">
					<span className={TAG}>{CHECKED}</span> seen live or on main on that date.
				</p>
			</div>
		</section>
	);
}
