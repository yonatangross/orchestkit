import { actionsServerCard, serverCardResponse } from "@/lib/server-card";

// Draft-spec server card for the Actions MCP, served at <server>/server-card,
// which is /api/mcp/actions/server-card for the server at /api/mcp/actions.
// /.well-known/ai-catalog.json lists it. No tools[]: a client learns the tools
// from tools/list on the live server. The older card at
// /.well-known/mcp/actions-server-card.json stays served, with its tools[].
// Dynamic so the Accept header is read on every request; a prerendered route
// would answer every client with the default type.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
	return serverCardResponse(actionsServerCard(), request);
}
