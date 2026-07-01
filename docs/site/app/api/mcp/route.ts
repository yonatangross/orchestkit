import { SITE } from "@/lib/constants";
import { getDocMarkdown } from "@/lib/doc-markdown";
import { searchDocs } from "@/lib/doc-search";
import { SEARCH_RESULTS_HTML, UI_SEARCH_RESULTS } from "@/lib/mcp-ui";

// Stateless MCP server over Streamable HTTP (JSON-RPC 2.0 on POST). Dependency-
// free: MCP's transport is JSON-RPC, so a stateless handler covering
// initialize / tools/list / tools/call is a compliant minimal server. The tools
// wrap the real documentation search, so nothing here is fabricated.
// Spec: https://modelcontextprotocol.io/specification (Streamable HTTP transport)
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

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
		// MCP Apps: results render inline via the ui:// template above.
		uiResource: UI_SEARCH_RESULTS,
		run: (args: Record<string, unknown>): ToolResult => {
			const query = String(args.query ?? "").trim();
			if (!query) return errText("Provide a non-empty `query`.");
			const hits = searchDocs(query);
			const textBody =
				hits.length === 0
					? `No documentation matched "${query}". Try broader terms, or list sections at ${SITE.domain}/docs/llms.txt.`
					: hits.map((h) => `- ${h.title} — ${h.url}\n  ${h.content}`).join("\n");
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
			"Fetch one OrchestKit documentation page as Markdown. Use after orchestkit_docs_search to read a page in full. Input: the page path (e.g. '/docs/getting-started/installation'). Returns the page Markdown.",
		inputSchema: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Page path, e.g. /docs/getting-started/installation",
				},
			},
			required: ["path"],
		},
		run: async (args: Record<string, unknown>): Promise<ToolResult> => {
			const path = String(args.path ?? "").trim();
			if (!path) return errText("Provide a `path`, e.g. /docs/foundations/overview.");
			const md = await getDocMarkdown(path);
			if (!md) {
				return errText(
					`No page at "${path}". Use orchestkit_docs_search to find a valid path.`,
				);
			}
			return text(md);
		},
	},
] as const;

function text(value: string): ToolResult {
	return { content: [{ type: "text", text: value }] };
}
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
					"Search the OrchestKit docs with orchestkit_docs_search, then read a page with orchestkit_docs_get.",
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
						// Both tools only read documentation — agents can call them
						// without user confirmation.
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
	const responses = (await Promise.all(requests.map(dispatch))).filter(
		(r): r is object => r !== null,
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
