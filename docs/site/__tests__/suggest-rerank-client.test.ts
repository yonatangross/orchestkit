import { describe, it, expect } from "vitest";
import type { Suggestion } from "@/lib/search-autocomplete";
import {
	SUGGEST_PAUSE_MS,
	isCurrentSuggestOrder,
	resolveSuggestions,
} from "@/lib/suggest-rerank-client";

function sug(url: string): Suggestion {
	return { url, title: url, label: url, via: "title" };
}

const LOCAL = [sug("/a"), sug("/b"), sug("/c")];
const JEV_ORDER = [sug("/c"), sug("/a"), sug("/b")];

describe("SUGGEST_PAUSE_MS", () => {
	it("waits for a typing pause, longer than the old 200 ms keystroke debounce", () => {
		expect(SUGGEST_PAUSE_MS).toBeGreaterThanOrEqual(400);
		expect(SUGGEST_PAUSE_MS).toBeLessThanOrEqual(500);
	});
});

describe("isCurrentSuggestOrder", () => {
	it("accepts an order for the query on screen", () => {
		expect(
			isCurrentSuggestOrder({ query: "mcp", mode: "jev", items: JEV_ORDER }, "mcp", "jev"),
		).toBe(true);
	});

	it("tolerates surrounding whitespace in the live input", () => {
		expect(
			isCurrentSuggestOrder({ query: "mcp", mode: "jev", items: JEV_ORDER }, "  mcp ", "jev"),
		).toBe(true);
	});

	it("rejects an order for a query the user has typed past", () => {
		expect(
			isCurrentSuggestOrder({ query: "mc", mode: "jev", items: JEV_ORDER }, "mcp", "jev"),
		).toBe(false);
	});

	it("rejects an order for a query the user has backspaced away from", () => {
		expect(
			isCurrentSuggestOrder({ query: "mcp s", mode: "jev", items: JEV_ORDER }, "mcp", "jev"),
		).toBe(false);
	});

	it("rejects an order from a different rerank mode", () => {
		expect(
			isCurrentSuggestOrder({ query: "mcp", mode: "llm", items: JEV_ORDER }, "mcp", "jev"),
		).toBe(false);
	});

	it("rejects nothing-yet", () => {
		expect(isCurrentSuggestOrder(null, "mcp", "jev")).toBe(false);
	});
});

describe("resolveSuggestions", () => {
	it("renders the deterministic order before any answer arrives", () => {
		expect(resolveSuggestions(LOCAL, null, "mcp", "jev")).toEqual(LOCAL);
	});

	it("applies the Jev order when the query is still current", () => {
		const server = { query: "mcp", mode: "jev", items: JEV_ORDER };
		expect(resolveSuggestions(LOCAL, server, "mcp", "jev")).toEqual(JEV_ORDER);
	});

	it("discards a late answer for an old query", () => {
		// The user typed "mc", paused, then typed "p" before Jev answered.
		const stale = { query: "mc", mode: "jev", items: JEV_ORDER };
		expect(resolveSuggestions(LOCAL, stale, "mcp", "jev")).toEqual(LOCAL);
	});

	it("never blanks the list when the server returns nothing usable", () => {
		const empty = { query: "mcp", mode: "jev", items: [] };
		expect(resolveSuggestions(LOCAL, empty, "mcp", "jev")).toEqual(LOCAL);
	});

	it("falls back to local the moment the dev toggle changes mode", () => {
		const server = { query: "mcp", mode: "jev", items: JEV_ORDER };
		expect(resolveSuggestions(LOCAL, server, "mcp", "off")).toEqual(LOCAL);
	});
});
