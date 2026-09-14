// WebMCP page tools: the tool definitions and the registration helper, kept
// free of React so a unit test can drive them with a mocked modelContext.
//
// Registration order follows the spec's current shape:
//   1. document.modelContext.registerTool(tool)   (per-page scope, preferred)
//   2. navigator.modelContext.registerTool(tool)  (older origin-trial builds)
//   3. navigator.modelContext.provideContext()    (the original imperative API)
// The first surface that exists wins; the rest are never touched, so a browser
// that ships both never sees the same tool registered twice.
// Spec: https://webmachinelearning.github.io/webmcp/

export interface WebMcpToolResult {
	content: Array<{ type: "text"; text: string }>;
}

export interface WebMcpTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	execute: (args: Record<string, unknown>) => Promise<WebMcpToolResult>;
}

export interface ModelContext {
	registerTool?: (tool: WebMcpTool) => unknown;
	provideContext?: (context: { tools: WebMcpTool[] }) => void;
}

/** Which surface the helper ended up registering on, for tests and logging. */
export type WebMcpSurface =
	| "document.registerTool"
	| "navigator.registerTool"
	| "navigator.provideContext"
	| "none";

type HasModelContext = { modelContext?: ModelContext };

function text(value: string): WebMcpToolResult {
	return { content: [{ type: "text", text: value }] };
}

/** Same query contract as app/api/search/route.ts and the ⌘K dialog. */
export const SEARCH_DOCS_DESCRIPTION =
	"Full-text search across ALL OrchestKit content (docs, skills, agents, hooks, compositions) via the unified index. Returns matching results with titles and URLs. Optionally filter by content type with `tag`.";

export const GET_PAGE_DESCRIPTION =
	"Fetch one OrchestKit docs page as Markdown by its path, e.g. '/docs/foundations/overview' or 'foundations/overview'. An empty path returns the site index.";

/** Map a user-facing docs path to the app/api/md route that serves its
 * Markdown twin. Accepts "/docs/a/b", "docs/a/b", "a/b", "/a/b.md" and the
 * bare "/" (site index). Anything with a scheme or ".." is refused. */
export function markdownRouteFor(path: string): string | null {
	let clean = path.trim();
	if (/^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.includes("..")) return null;
	clean = clean.replace(/^\/+/, "").replace(/\/+$/, "");
	if (clean === "docs") clean = "";
	else if (clean.startsWith("docs/")) clean = clean.slice("docs/".length);
	if (clean.endsWith(".md")) clean = clean.slice(0, -".md".length);
	if (clean === "index") clean = "";
	return clean ? `/api/md/${clean}` : "/api/md";
}

export const WEBMCP_TOOLS: WebMcpTool[] = [
	{
		name: "search_docs",
		description: SEARCH_DOCS_DESCRIPTION,
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "Search term" },
				tag: {
					type: "string",
					enum: ["docs", "skill", "agent", "hook", "composition"],
					description:
						"Restrict results to one content type (e.g. 'skill' or 'agent'). Omit to search everything.",
				},
			},
			required: ["query"],
		},
		execute: async (args) => {
			const query = String(args.query ?? "").trim();
			if (!query) return text("Provide a non-empty query.");
			const params = new URLSearchParams({ query });
			const tag = String(args.tag ?? "").trim();
			if (tag) params.set("tag", tag);
			const res = await fetch(`/api/search?${params.toString()}`);
			if (!res.ok) return text(`Search failed (${res.status}).`);
			return text(await res.text());
		},
	},
	{
		name: "get_page",
		description: GET_PAGE_DESCRIPTION,
		inputSchema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description:
						"Docs page path, e.g. '/docs/foundations/overview'. Omit or pass '/' for the site index.",
				},
			},
		},
		execute: async (args) => {
			const route = markdownRouteFor(String(args.path ?? ""));
			if (!route) return text("Provide a docs path such as '/docs/foundations/overview'.");
			const res = await fetch(route, { headers: { Accept: "text/markdown" } });
			if (!res.ok) return text(`Page not found (${res.status}).`);
			return text(await res.text());
		},
	},
	{
		name: "list_skills",
		description:
			"List all OrchestKit skills (name + description) from the agent-skills discovery index.",
		inputSchema: { type: "object", properties: {} },
		execute: async () => {
			const res = await fetch("/.well-known/agent-skills/index.json");
			if (!res.ok) return text(`Could not load skills index (${res.status}).`);
			const data: unknown = await res.json();
			const skills =
				data && typeof data === "object" && "skills" in data
					? (data as { skills: Array<{ name: string; description: string }> })
							.skills
					: [];
			return text(
				skills.map((s) => `- ${s.name}: ${s.description}`).join("\n"),
			);
		},
	},
	{
		name: "get_skill",
		description:
			"Fetch a single OrchestKit skill's documentation as Markdown by skill name.",
		inputSchema: {
			type: "object",
			properties: {
				name: { type: "string", description: "Skill name, e.g. 'assess'" },
			},
			required: ["name"],
		},
		execute: async (args) => {
			const name = String(args.name ?? "")
				.trim()
				.toLowerCase();
			if (!name) return text("Provide a skill name.");
			const res = await fetch(`/docs/reference/skills/${name}`, {
				headers: { Accept: "text/markdown" },
			});
			if (!res.ok) return text(`Skill '${name}' not found (${res.status}).`);
			return text(await res.text());
		},
	},
];

/** Register `tools` on the first WebMCP surface the browser exposes.
 * Feature-detected at every step, so it is a no-op (returns "none") in a
 * browser without the API. */
export function registerWebMcpTools(
	doc: object,
	nav: object,
	tools: WebMcpTool[] = WEBMCP_TOOLS,
): WebMcpSurface {
	// `object` rather than HasModelContext: every field there is optional, so
	// TS's weak-type check would reject the real `document` and `navigator`.
	const docCtx = (doc as HasModelContext).modelContext;
	if (typeof docCtx?.registerTool === "function") {
		for (const tool of tools) docCtx.registerTool(tool);
		return "document.registerTool";
	}
	const navCtx = (nav as HasModelContext).modelContext;
	if (typeof navCtx?.registerTool === "function") {
		for (const tool of tools) navCtx.registerTool(tool);
		return "navigator.registerTool";
	}
	if (typeof navCtx?.provideContext === "function") {
		navCtx.provideContext({ tools });
		return "navigator.provideContext";
	}
	return "none";
}
