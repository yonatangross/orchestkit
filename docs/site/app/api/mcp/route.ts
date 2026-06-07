import { SITE } from "@/lib/constants";
import { getDocMarkdown, searchDocs } from "@/lib/doc-search";

// Stateless MCP server over Streamable HTTP (JSON-RPC 2.0 on POST). Dependency-
// free: MCP's transport is JSON-RPC, so a stateless handler covering
// initialize / tools/list / tools/call is a compliant minimal server. The tools
// wrap the real documentation search, so nothing here is fabricated.
// Spec: https://modelcontextprotocol.io/specification (Streamable HTTP transport)
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2025-06-18";

type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

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
		run: (args: Record<string, unknown>): ToolResult => {
			const query = String(args.query ?? "").trim();
			if (!query) return errText("Provide a non-empty `query`.");
			const hits = searchDocs(query);
			if (hits.length === 0) {
				return text(
					`No documentation matched "${query}". Try broader terms, or list sections at ${SITE.domain}/docs/llms.txt.`,
				);
			}
			return text(
				hits.map((h) => `- ${h.title} — ${h.url}\n  ${h.content}`).join("\n"),
			);
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
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: `${SITE.name} Docs MCP`, version: SITE.version },
				instructions:
					"Search the OrchestKit docs with orchestkit_docs_search, then read a page with orchestkit_docs_get.",
			});
		case "ping":
			return rpcResult(req.id, {});
		case "tools/list":
			return rpcResult(req.id, {
				tools: TOOLS.map(({ name, description, inputSchema }) => ({
					name,
					description,
					inputSchema,
				})),
			});
		case "tools/call": {
			const name = req.params?.name as string;
			const args = (req.params?.arguments as Record<string, unknown>) ?? {};
			const tool = TOOLS.find((t) => t.name === name);
			if (!tool) return rpcError(req.id, -32602, `Unknown tool: ${name}`);
			return rpcResult(req.id, await tool.run(args));
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
