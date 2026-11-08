import { serverCard, serverCardResponse } from "@/lib/server-card";

// MCP server card, served where the draft server-card extension (SEP-2127)
// puts it: <server>/server-card, which is /api/mcp/server-card for the server
// at /api/mcp. $schema names the draft server-card identifier; the fields
// follow the published MCP registry server.json schema (lib/server-card.ts).
// It is the canonical card that /.well-known/ai-catalog.json lists.
//
// It carries no tools[] on purpose: the extension says a client learns the
// tools from tools/list on the live server, so a static copy can only drift.
// The older card at /.well-known/mcp/server-card.json stays served, with its
// tools[], for checkers that already read it.
// Dynamic so the Accept header is read on every request; a prerendered route
// would answer every client with the default type.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
	return serverCardResponse(serverCard(), request);
}
