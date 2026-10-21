import { serverCard } from "@/lib/server-card";

// MCP server card in the shape of the draft server-card extension, served at
// <server>/server-card, which is /api/mcp/server-card for the server at
// /api/mcp. It is the canonical card that /.well-known/ai-catalog.json lists.
//
// It carries no tools[] on purpose: the extension says a client learns the
// tools from tools/list on the live server, so a static copy can only drift.
// The older card at /.well-known/mcp/server-card.json stays served, with its
// tools[], for checkers that already read it.
export const revalidate = false;

export function GET() {
	return new Response(JSON.stringify(serverCard(), null, 2), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
}
