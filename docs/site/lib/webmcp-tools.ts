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

// One path segment of a docs slug or skill name. Allowlist, not denylist: a
// denied ".." still let "%2e%2e" through, because the browser's URL parser
// percent-decodes and normalizes dot segments AFTER our check ran, so the
// request left for /api/jobs/<token> instead of /api/md/. Every real slug on
// the site matches this (checked against all 277 docs files and every skill
// directory), so nothing legitimate is lost.
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

/** Percent-decode once, then require every "/"-separated segment to be a
 * plain slug. Returns the decoded segments, or null when any segment fails
 * (including "." and "..", which the regex also rejects, and undecodable
 * input). Empty segments from doubled slashes are dropped. */
export function safeSlugSegments(raw: string): string[] | null {
	let decoded: string;
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		return null;
	}
	const segments = decoded.split("/").filter((s) => s.length > 0);
	for (const s of segments) {
		if (s === "." || s === ".." || !SAFE_SEGMENT.test(s)) return null;
	}
	return segments;
}

/** Map a user-facing docs path to the app/api/md route that serves its
 * Markdown twin. Accepts "/docs/a/b", "docs/a/b", "a/b", "/a/b.md" and the
 * bare "/" (site index). Anything with a scheme, or any segment outside the
 * slug allowlist (encoded or not), is refused. */
export function markdownRouteFor(path: string): string | null {
	const trimmed = path.trim();
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
	const segments = safeSlugSegments(trimmed);
	if (segments === null) return null;
	if (segments[0] === "docs") segments.shift();
	const last = segments.length - 1;
	if (last >= 0 && segments[last].endsWith(".md")) {
		segments[last] = segments[last].slice(0, -".md".length);
		if (!SAFE_SEGMENT.test(segments[last])) return null;
	}
	if (segments.length === 1 && segments[0] === "index") segments.pop();
	return segments.length ? `/api/md/${segments.join("/")}` : "/api/md";
}

/** Map a skill name to its docs page. Exactly one allowlisted segment, so
 * "../../../admin" and its encoded forms are refused rather than resolved. */
export function skillRouteFor(name: string): string | null {
	const segments = safeSlugSegments(name.trim().toLowerCase());
	if (segments === null || segments.length !== 1) return null;
	return `/docs/reference/skills/${segments[0]}`;
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
			const name = String(args.name ?? "").trim();
			if (!name) return text("Provide a skill name.");
			const route = skillRouteFor(name);
			if (!route) return text("Skill names are plain slugs such as 'assess'.");
			const res = await fetch(route, { headers: { Accept: "text/markdown" } });
			if (!res.ok) return text(`Skill '${name}' not found (${res.status}).`);
			return text(await res.text());
		},
	},
];

/** Tool names the page already declares through the declarative API
 * (`<form toolname="...">`). A page that carries one of those must not also
 * register the same name imperatively: the origin-trial's behavior on a
 * duplicate name is unspecified, and the docs site has no error boundary. */
export function declaredToolNames(doc: object): Set<string> {
	const names = new Set<string>();
	const query = (doc as { querySelectorAll?: (s: string) => ArrayLike<Element> })
		.querySelectorAll;
	if (typeof query !== "function") return names;
	const forms = query.call(doc, "form[toolname]");
	for (let i = 0; i < forms.length; i++) {
		const name = forms[i].getAttribute("toolname");
		if (name) names.add(name);
	}
	return names;
}

/** Log a failed registration without letting it escape. This runs from a
 * layout-level effect, and docs/site/app has no error.tsx, so a throwing
 * browser API would otherwise take the whole page to the Next error screen. */
function guarded(what: string, fn: () => unknown): void {
	try {
		fn();
	} catch (err) {
		console.warn(`[webmcp] ${what} failed`, err);
	}
}

/** Register `tools` on the first WebMCP surface the browser exposes.
 * Feature-detected at every step, so it is a no-op (returns "none") in a
 * browser without the API. Tools already declared on the page through a
 * `<form toolname>` are skipped so each name is declared exactly once. */
export function registerWebMcpTools(
	doc: object,
	nav: object,
	tools: WebMcpTool[] = WEBMCP_TOOLS,
): WebMcpSurface {
	// `object` rather than HasModelContext: every field there is optional, so
	// TS's weak-type check would reject the real `document` and `navigator`.
	const declared = declaredToolNames(doc);
	const pending = tools.filter((t) => !declared.has(t.name));
	const docCtx = (doc as HasModelContext).modelContext;
	if (typeof docCtx?.registerTool === "function") {
		for (const tool of pending)
			guarded(`registerTool(${tool.name})`, () => docCtx.registerTool?.(tool));
		return "document.registerTool";
	}
	const navCtx = (nav as HasModelContext).modelContext;
	if (typeof navCtx?.registerTool === "function") {
		for (const tool of pending)
			guarded(`registerTool(${tool.name})`, () => navCtx.registerTool?.(tool));
		return "navigator.registerTool";
	}
	if (typeof navCtx?.provideContext === "function") {
		guarded("provideContext", () => navCtx.provideContext?.({ tools: pending }));
		return "navigator.provideContext";
	}
	return "none";
}
