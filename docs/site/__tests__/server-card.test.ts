// Draft-spec MCP server card at <server>/server-card, listed in ai-catalog.

import { describe, expect, it } from "vitest";
import { GET as actionsServerCardGET } from "@/app/api/mcp/actions/server-card/route";
import { GET as serverCardGET } from "@/app/api/mcp/server-card/route";
import { GET as catalogGET } from "@/app/api/well-known/ai-catalog/route";
import {
	SERVER_CARD_SCHEMA,
	actionsServerCard,
	serverCard,
} from "@/lib/server-card";

describe("MCP server card (draft server-card extension)", () => {
	it("has the spec fields and no tools[]", async () => {
		const card = await serverCardGET().json();
		expect(card.$schema).toBe(SERVER_CARD_SCHEMA);
		expect(card.$schema).toBe(
			"https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
		);
		expect(card.name).toBe("dev.orchestkit/mcp");
		expect(typeof card.version).toBe("string");
		expect(card.description.length).toBeGreaterThan(0);
		expect(card.description.length).toBeLessThanOrEqual(100);
		expect(card.remotes).toEqual([
			{ type: "streamable-http", url: "https://orchestkit.dev/api/mcp" },
		]);
		expect(card).not.toHaveProperty("tools");
		expect(card).toEqual(serverCard());
	});

	it("is the MCP entry in ai-catalog.json", async () => {
		const catalog = await catalogGET().json();
		const urls = catalog.entries.map((e: { url: string }) => e.url);
		expect(urls).toContain("https://orchestkit.dev/api/mcp/server-card");
	});
});

// orank (2026-10-21) found the product MCP at /api/mcp/actions without a card
// in the draft shape. Same rules as the docs card, own name and remote.
describe("Actions MCP server card (draft server-card extension)", () => {
	it("has the spec fields, its exact server URL and no tools[]", async () => {
		const res = actionsServerCardGET();
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		const card = await res.json();
		expect(card.$schema).toBe(SERVER_CARD_SCHEMA);
		expect(card.name).toBe("dev.orchestkit/actions");
		expect(card.name).toMatch(/^[a-z0-9.-]+\/[a-z0-9._-]+$/);
		expect(card.name).not.toBe(serverCard().name);
		expect(typeof card.version).toBe("string");
		expect(card.description.length).toBeGreaterThan(0);
		expect(card.description.length).toBeLessThanOrEqual(100);
		expect(card.remotes).toEqual([
			{ type: "streamable-http", url: "https://orchestkit.dev/api/mcp/actions" },
		]);
		expect(card).not.toHaveProperty("tools");
		expect(card).toEqual(actionsServerCard());
	});

	it("is listed in ai-catalog.json as an MCP server card", async () => {
		const catalog = await catalogGET().json();
		const entry = catalog.entries.find(
			(e: { url: string }) =>
				e.url === "https://orchestkit.dev/api/mcp/actions/server-card",
		);
		expect(entry).toBeDefined();
		expect(entry.type).toBe("application/mcp-server-card+json");
		expect(entry.displayName).toContain("OrchestKit");
	});
});
