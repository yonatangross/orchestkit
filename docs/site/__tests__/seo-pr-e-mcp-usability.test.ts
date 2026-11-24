// orchestkit.dev SEO gaps row 12 (orank Usability, oc20 table 15.11.2026).
// Live tools/list on 15.11 (VERIFIED): 2 tools, both with readOnlyHint and
// destructiveHint, neither with an outputSchema; server instructions 98
// characters. Each tool must declare an outputSchema, return matching
// structuredContent, and the instructions must run over 100 characters.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/doc-markdown", () => ({
	getDocMarkdown: async (p: string) => (p === "/docs/x" ? "# X\n\nBody." : null),
}));
vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: () => {} }));

async function rpc(method: string, params: Record<string, unknown> = {}) {
	const { POST } = await import("@/app/api/mcp/route");
	const res = await POST(
		new Request("https://orchestkit.dev/api/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		}),
	);
	return (await res.json()).result;
}

describe("row 12: docs MCP usability", () => {
	it("server instructions run over 100 characters", async () => {
		const r = await rpc("initialize", { protocolVersion: "2025-06-18" });
		expect(r.instructions.length).toBeGreaterThan(100);
	});

	it("every tool declares an object outputSchema and the read-only hints", async () => {
		const { tools } = await rpc("tools/list");
		expect(tools.length).toBeGreaterThan(0);
		for (const t of tools) {
			expect(t.outputSchema?.type, t.name).toBe("object");
			expect(t.annotations.readOnlyHint, t.name).toBe(true);
			expect(t.annotations.destructiveHint, t.name).toBe(false);
		}
	});

	it("search returns structuredContent with the declared results array", async () => {
		const r = await rpc("tools/call", { name: "orchestkit_docs_search", arguments: { query: "install" } });
		expect(Array.isArray(r.structuredContent.results)).toBe(true);
	});

	it("an error result is isError with text only, no structuredContent to validate (b168 LOW note)", async () => {
		const miss = await rpc("tools/call", { name: "orchestkit_docs_get", arguments: { path: "/docs/nope" } });
		expect(miss.isError).toBe(true);
		expect(miss.structuredContent).toBeUndefined();
		const empty = await rpc("tools/call", { name: "orchestkit_docs_search", arguments: { query: "" } });
		expect(empty.isError).toBe(true);
		expect(empty.structuredContent).toBeUndefined();
	});

	it("get returns structuredContent with the path and the Markdown", async () => {
		const r = await rpc("tools/call", { name: "orchestkit_docs_get", arguments: { path: "/docs/x" } });
		expect(r.structuredContent).toEqual({ path: "/docs/x", markdown: "# X\n\nBody." });
		expect(r.content[0].text).toBe("# X\n\nBody.");
	});
});

describe("docs MCP protocol version negotiation", () => {
	it.each(["2025-06-18", "2025-03-26", "2024-11-05"])("echoes supported version %s", async (version) => {
		const r = await rpc("initialize", { protocolVersion: version });
		expect(r.protocolVersion).toBe(version);
	});

	it.each(["2099-01-01", "not-a-date", 20250618])("answers unsupported version %s with the latest supported one", async (version) => {
		const r = await rpc("initialize", { protocolVersion: version });
		expect(r.protocolVersion).toBe("2025-06-18");
	});

	it("answers an omitted version with the latest supported one", async () => {
		const r = await rpc("initialize");
		expect(r.protocolVersion).toBe("2025-06-18");
	});
});
