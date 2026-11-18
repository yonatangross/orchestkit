// Guards the CORS grant for browser-based MCP hosts. A host on another origin
// sends MCP transport headers on every POST to /api/mcp; a header missing from
// Access-Control-Allow-Headers fails the preflight, so the request is never
// made and the host sees only a network error. Header names from the MCP spec,
// Streamable HTTP transport, revision 2026-07-28 (and the 2025-06-18 to
// 2025-11-25 headers it lists under Backward Compatibility).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(__dirname, "../next.config.mjs"), "utf8");

function headerList(key: string): string[] {
	const block = config.match(new RegExp(`"${key}",[\\s\\S]{0,900}?\\.join\\(", "\\)`))?.[0] ?? "";
	return [...block.matchAll(/"([A-Za-z-]+)",?\s*$/gm)]
		.map((m) => m[1].toLowerCase())
		.filter((name) => name !== key.toLowerCase());
}

describe("MCP transport headers pass a cross-origin preflight", () => {
	const allowed = headerList("Access-Control-Allow-Headers");
	const exposed = headerList("Access-Control-Expose-Headers");

	it("finds both header lists in next.config.mjs", () => {
		expect(allowed.length, "no Access-Control-Allow-Headers list found").toBeGreaterThan(0);
		expect(exposed.length, "no Access-Control-Expose-Headers list found").toBeGreaterThan(0);
	});

	it("keeps the basic request headers", () => {
		for (const name of ["content-type", "accept"]) expect(allowed).toContain(name);
	});

	it("allows every MCP request header a browser host sends", () => {
		for (const name of [
			"mcp-protocol-version",
			"mcp-method",
			"mcp-name",
			"mcp-session-id",
			"last-event-id",
		]) {
			expect(allowed, `MCP header not allowed by CORS: ${name}`).toContain(name);
		}
	});

	it("exposes Mcp-Session-Id so a session-era client can read it back", () => {
		expect(exposed).toContain("mcp-session-id");
	});
});
