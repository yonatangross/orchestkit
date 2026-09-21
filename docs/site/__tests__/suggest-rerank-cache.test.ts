import { describe, it, expect } from "vitest";
import {
	SuggestOrderCache,
	normalizeSuggestQuery,
	suggestCacheKey,
} from "@/lib/suggest-rerank-cache";

describe("normalizeSuggestQuery", () => {
	it("collapses the prefixes that produce the same shortlist", () => {
		expect(normalizeSuggestQuery("  MCP  ")).toBe("mcp");
		expect(normalizeSuggestQuery("Hook   Debugging")).toBe("hook debugging");
		expect(normalizeSuggestQuery("mcp")).toBe(normalizeSuggestQuery("MCP"));
	});

	it("keeps genuinely different prefixes apart", () => {
		expect(normalizeSuggestQuery("mcp")).not.toBe(normalizeSuggestQuery("mc"));
	});
});

describe("suggestCacheKey", () => {
	it("separates modes so a dev llm order never serves a jev request", () => {
		expect(suggestCacheKey("jev", "MCP")).toBe("jev:mcp");
		expect(suggestCacheKey("llm", "MCP")).toBe("llm:mcp");
		expect(suggestCacheKey("jev", "MCP")).not.toBe(suggestCacheKey("llm", "mcp"));
	});
});

describe("SuggestOrderCache", () => {
	it("returns a stored order and misses on an unknown key", () => {
		const cache = new SuggestOrderCache();
		cache.set("jev:mcp", ["/a", "/b"]);
		expect(cache.get("jev:mcp")).toEqual(["/a", "/b"]);
		expect(cache.get("jev:mc")).toBeUndefined();
	});

	it("copies on write, so a later mutation of the caller's array cannot leak in", () => {
		const cache = new SuggestOrderCache();
		const order = ["/a", "/b"];
		cache.set("jev:mcp", order);
		order[0] = "/mutated";
		expect(cache.get("jev:mcp")).toEqual(["/a", "/b"]);
	});

	it("evicts least-recently-used past maxEntries", () => {
		const cache = new SuggestOrderCache(2);
		cache.set("a", ["/a"]);
		cache.set("b", ["/b"]);
		// Touching "a" makes "b" the least recently used.
		expect(cache.get("a")).toEqual(["/a"]);
		cache.set("c", ["/c"]);
		expect(cache.size).toBe(2);
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("a")).toEqual(["/a"]);
		expect(cache.get("c")).toEqual(["/c"]);
	});

	it("never grows past maxEntries under distinct keys", () => {
		const cache = new SuggestOrderCache(3);
		for (let i = 0; i < 50; i++) cache.set(`k${i}`, [`/p${i}`]);
		expect(cache.size).toBe(3);
	});

	it("expires an entry once it is older than the TTL", () => {
		let now = 1000;
		const cache = new SuggestOrderCache(10, 500, () => now);
		cache.set("jev:mcp", ["/a"]);
		now = 1400;
		expect(cache.get("jev:mcp")).toEqual(["/a"]);
		now = 1500;
		expect(cache.get("jev:mcp")).toBeUndefined();
		// The expired entry is dropped, not merely hidden.
		expect(cache.size).toBe(0);
	});

	it("clear empties the cache", () => {
		const cache = new SuggestOrderCache();
		cache.set("a", ["/a"]);
		cache.clear();
		expect(cache.size).toBe(0);
		expect(cache.get("a")).toBeUndefined();
	});
});
