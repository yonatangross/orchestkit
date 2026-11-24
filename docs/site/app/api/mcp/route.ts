import { acceptFamily, uaFamily } from "@/lib/agent-surface";
import { reportServerEvents } from "@/lib/analytics-server";
import { SITE } from "@/lib/constants";
import { getDocMarkdown } from "@/lib/doc-markdown";
import { searchDocs } from "@/lib/doc-search";
import { mcpTelemetryEvents } from "@/lib/mcp-telemetry";
import {
	buildInstallPicker,
	buildSkillCard,
	installPickerText,
	skillCardText,
} from "@/lib/mcp-cards";
import { SEARCH_RESULTS_HTML, UI_SEARCH_RESULTS } from "@/lib/mcp-ui";
import {
	INSTALL_PICKER_HTML,
	SKILL_CARD_HTML,
	UI_INSTALL_PICKER,
	UI_SKILL_CARD,
} from "@/lib/mcp-ui-cards";

// Stateless MCP server over Streamable HTTP (JSON-RPC 2.0 on POST). Dependency-
// free: MCP's transport is JSON-RPC, so a stateless handler covering
// initialize / tools/list / tools/call is a compliant minimal server. The tools
// wrap the real documentation search, so nothing here is fabricated.
// Spec: https://modelcontextprotocol.io/specification (Streamable HTTP transport)
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

const SITE_ORIGIN = new URL(SITE.domain).origin;

// orchestkit_docs_search returns absolute URLs, so orchestkit_docs_get takes
// those as well as paths. Only this site's origin is accepted, and only its
// pathname is used for the local lookup: caller URLs are never fetched.
function docPathFromInput(input: string): string | null {
	if (!URL.canParse(input)) return input;
	const url = new URL(input);
	return url.origin === SITE_ORIGIN ? url.pathname : null;
}

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent?: unknown;
	_meta?: Record<string, unknown>;
	isError?: boolean;
};

// MCP Apps (ext-apps): a ui:// HTML resource the host renders inline in the
// conversation. The search tool references it via `_meta.ui.resourceUri` and
// returns `structuredContent` the template draws. Markup + its CSP live in
// lib/mcp-ui.ts (extracted so the policy can be unit-tested).
const UI_RESOURCES = [
	{
		uri: UI_SEARCH_RESULTS,
		name: "OrchestKit search results",
		description: "Renders documentation search hits as a clickable list.",
		mimeType: "text/html;profile=mcp-app",
		text: SEARCH_RESULTS_HTML,
	},
	{
		uri: UI_SKILL_CARD,
		name: "OrchestKit skill card",
		description:
			"Renders one skill as a card: what it does, which plugin ships it, and the install line with a copy button.",
		mimeType: "text/html;profile=mcp-app",
		text: SKILL_CARD_HTML,
	},
	{
		uri: UI_INSTALL_PICKER,
		name: "OrchestKit install picker",
		description:
			"Renders a host picker (Claude Code, Cursor, Codex) that shows the exact install command for the picked host, with a copy button.",
		mimeType: "text/html;profile=mcp-app",
		text: INSTALL_PICKER_HTML,
	},
];

// Tool descriptions are prompts: each says when to use it, what to pass, and what
// comes back. Names are prefix-namespaced so an agent can select the right one.
const TOOLS = [
	{
		name: "orchestkit_docs_search",
		description:
			"Search the OrchestKit documentation. Use this first to find the right page for a question. Input: a query string. Returns a ranked list of pages with titles and URLs.",
		inputSchema: {
			type: "object",
			properties: {
				query: { type: "string", description: "What to search for." },
			},
			required: ["query"],
		},
		// MCP: a tool that returns structuredContent declares its shape, so a
		// client can validate it (orank Usability, SEO gaps row 12).
		outputSchema: {
			type: "object",
			properties: {
				results: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							title: { type: "string" },
							url: { type: "string" },
							content: { type: "string" },
						},
						required: ["id", "title", "url", "content"],
					},
				},
			},
			required: ["results"],
		},
		// MCP Apps: results render inline via the ui:// template above.
		uiResource: UI_SEARCH_RESULTS,
		run: (args: Record<string, unknown>): ToolResult => {
			const query = String(args.query ?? "").trim();
			if (!query) return errText("Provide a non-empty `query`.");
			const hits = searchDocs(query);
			const textBody =
				hits.length === 0
					? `No documentation matched "${query}". Try broader terms, or list sections at ${SITE.domain}/docs/llms.txt.`
					: hits.map((h) => `- ${h.title}: ${h.url}\n  ${h.content}`).join("\n");
			return {
				content: [{ type: "text", text: textBody }],
				structuredContent: { results: hits },
				_meta: { ui: { resourceUri: UI_SEARCH_RESULTS } },
			};
		},
	},
	{
		name: "orchestkit_docs_get",
		description:
			"Fetch one OrchestKit documentation page as Markdown. Use after orchestkit_docs_search to read a page in full. Input: the page path (e.g. '/docs/getting-started/installation') or the result URL from orchestkit_docs_search. Returns the page Markdown.",
		inputSchema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description:
						"Page path, e.g. /docs/getting-started/installation, or a search result URL on the same site",
				},
			},
			required: ["path"],
		},
		outputSchema: {
			type: "object",
			properties: {
				path: { type: "string", description: "The page path that was read." },
				markdown: { type: "string", description: "The page as Markdown." },
			},
			required: ["path", "markdown"],
		},
		run: async (args: Record<string, unknown>): Promise<ToolResult> => {
			const input = String(args.path ?? "").trim();
			if (!input) return errText("Provide a `path`, e.g. /docs/foundations/overview.");
			const path = docPathFromInput(input);
			if (path === null) {
				return errText(
					`"${input}" is not an OrchestKit docs URL. Pass a path like /docs/getting-started/installation or a ${SITE.domain}/docs/... URL from orchestkit_docs_search.`,
				);
			}
			const md = await getDocMarkdown(path);
			if (!md) {
				return errText(
					`No page at "${input}". Use orchestkit_docs_search to find a valid path.`,
				);
			}
			return {
				content: [{ type: "text", text: md }],
				structuredContent: { path, markdown: md },
			};
		},
	},
	{
		name: "orchestkit_skill_get",
		description:
			"Show one OrchestKit skill as a card: what it does, which plugin ships it (ork or ork-extras), and the Claude Code install line. Use when a person asks about a skill by name. Input: the skill name, e.g. 'brainstorm'. An unknown name returns a 'no such skill' card with the nearest names.",
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Skill name, e.g. brainstorm. A leading / or ork: is fine.",
				},
			},
			required: ["name"],
		},
		// One shape per outcome: a found skill, or the nearest names to a miss.
		outputSchema: {
			type: "object",
			properties: {
				found: { type: "boolean" },
				name: { type: "string" },
				description: { type: "string" },
				summary: { type: "string" },
				useWhen: { type: ["string", "null"] },
				plugin: { type: "string", enum: ["ork", "ork-extras"] },
				version: { type: "string" },
				invoke: { type: ["string", "null"] },
				installCommand: { type: "string" },
				docsUrl: { type: "string" },
				query: { type: "string" },
				suggestions: { type: "array", items: { type: "string" } },
				browseUrl: { type: "string" },
			},
			required: ["found"],
		},
		uiResource: UI_SKILL_CARD,
		run: (args: Record<string, unknown>): ToolResult => {
			const name = String(args.name ?? "").trim();
			if (!name) return errText("Provide a skill `name`, e.g. brainstorm.");
			const card = buildSkillCard(name);
			return {
				content: [{ type: "text", text: skillCardText(card) }],
				structuredContent: card,
				_meta: { ui: { resourceUri: UI_SKILL_CARD } },
			};
		},
	},
	{
		name: "orchestkit_install",
		description:
			"Show how to install OrchestKit as a picker: Claude Code, Cursor or Codex, with the exact command for the picked host and a copy button. Use when a person asks how to install or set it up. Input: an optional host (claude, cursor or codex) to preselect.",
		inputSchema: {
			type: "object",
			properties: {
				host: {
					type: "string",
					enum: ["claude", "cursor", "codex"],
					description: "Host to preselect. Defaults to claude.",
				},
			},
		},
		outputSchema: {
			type: "object",
			properties: {
				selected: { type: "string", enum: ["claude", "cursor", "codex"] },
				hosts: {
					type: "array",
					items: {
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
							what: { type: "string" },
							where: { type: "string" },
							commands: { type: "array", items: { type: "string" } },
							copy: { type: "string" },
							prompt: { type: "boolean" },
							copyLabel: { type: "string" },
							docsUrl: { type: "string" },
						},
						required: ["id", "name", "commands", "copy"],
					},
				},
			},
			required: ["selected", "hosts"],
		},
		uiResource: UI_INSTALL_PICKER,
		run: (args: Record<string, unknown>): ToolResult => {
			const picker = buildInstallPicker(args.host);
			return {
				content: [{ type: "text", text: installPickerText(picker) }],
				structuredContent: picker,
				_meta: { ui: { resourceUri: UI_INSTALL_PICKER } },
			};
		},
	},
] as const;

function errText(value: string): ToolResult {
	return { content: [{ type: "text", text: value }], isError: true };
}

type RpcRequest = {
	jsonrpc: "2.0";
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
};

function rpcResult(id: RpcRequest["id"], result: unknown) {
	return { jsonrpc: "2.0" as const, id, result };
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
	return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

async function dispatch(req: RpcRequest): Promise<object | null> {
	switch (req.method) {
		case "initialize":
			return rpcResult(req.id, {
				protocolVersion:
					(req.params?.protocolVersion as string) ?? PROTOCOL_VERSION,
				capabilities: {
					tools: { listChanged: false },
					// MCP Apps: ui:// resources rendered inline by the host.
					resources: { listChanged: false },
				},
				serverInfo: { name: `${SITE.name} Docs MCP`, version: SITE.version },
				instructions:
					"Read-only access to the OrchestKit documentation. Call orchestkit_docs_search with a question to get ranked page URLs, then orchestkit_docs_get with one page path to read that page as Markdown. Call orchestkit_skill_get with a skill name for a skill card, or orchestkit_install for an install picker (Claude Code, Cursor, Codex). No tool changes anything.",
			});
		case "ping":
			return rpcResult(req.id, {});
		case "tools/list":
			return rpcResult(req.id, {
				tools: TOOLS.map((t) => {
					const ui = "uiResource" in t ? t.uiResource : undefined;
					return {
						name: t.name,
						description: t.description,
						inputSchema: t.inputSchema,
						outputSchema: t.outputSchema,
						// Every tool only reads documentation or generated data, so
						// agents can call them without user confirmation.
						annotations: {
							title: t.name,
							readOnlyHint: true,
							destructiveHint: false,
							idempotentHint: true,
							openWorldHint: false,
						},
						// MCP Apps: link the inline UI template for tools that have one.
						...(ui
							? { _meta: { ui: { resourceUri: ui }, "openai/outputTemplate": ui } }
							: {}),
					};
				}),
			});
		case "tools/call": {
			const name = req.params?.name as string;
			const args = (req.params?.arguments as Record<string, unknown>) ?? {};
			const tool = TOOLS.find((t) => t.name === name);
			if (!tool) return rpcError(req.id, -32602, `Unknown tool: ${name}`);
			return rpcResult(req.id, await tool.run(args));
		}
		case "resources/list":
			return rpcResult(req.id, {
				resources: UI_RESOURCES.map(({ uri, name, description, mimeType }) => ({
					uri,
					name,
					description,
					mimeType,
				})),
			});
		case "resources/read": {
			const uri = req.params?.uri as string;
			const resource = UI_RESOURCES.find((r) => r.uri === uri);
			if (!resource) return rpcError(req.id, -32602, `Unknown resource: ${uri}`);
			return rpcResult(req.id, {
				contents: [
					{ uri: resource.uri, mimeType: resource.mimeType, text: resource.text },
				],
			});
		}
		default:
			// Notifications (e.g. notifications/initialized) carry no id — no reply.
			if (req.id === undefined || req.id === null) return null;
			return rpcError(req.id, -32601, `Method not found: ${req.method}`);
	}
}

export async function POST(request: Request) {
	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
	}

	const batch = Array.isArray(payload);
	const requests = (batch ? payload : [payload]) as RpcRequest[];
	const pairs = await Promise.all(
		requests.map(async (r) => ({ request: r, response: await dispatch(r) })),
	);
	const responses = pairs
		.map((p) => p.response)
		.filter((r): r is object => r !== null);

	// Fire-and-forget: `reportServerEvents` hands the send to Next's `after()`,
	// so this adds nothing to the response path. The whole batch goes in ONE
	// ingest POST rather than one per JSON-RPC request.
	reportServerEvents(
		request.headers,
		mcpTelemetryEvents(pairs, {
			ua_family: uaFamily(request.headers.get("user-agent")),
			accept_family: acceptFamily(request.headers.get("accept") ?? ""),
		}),
	);

	// A POST with only notifications produces no responses → 202 Accepted.
	if (responses.length === 0) return new Response(null, { status: 202 });

	return Response.json(batch ? responses : responses[0]);
}

// This stateless server initiates no server→client messages, so it does not open
// an SSE stream on GET (allowed by the Streamable HTTP spec).
export function GET() {
	return new Response("Method Not Allowed", {
		status: 405,
		headers: { Allow: "POST" },
	});
}

// CORS preflight so browser-based agents can open the transport cross-origin.
// CORS headers are attached globally in next.config.mjs.
export function OPTIONS() {
	return new Response(null, { status: 204 });
}
