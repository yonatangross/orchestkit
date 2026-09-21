// Server-side cache for the typeahead Jev order, keyed by normalized query.
//
// A typeahead walks prefixes: "mc" then "mcp" then "mcp ser" then back to
// "mcp" on a backspace. Without a cache each revisit pays a full TypeSafe
// round trip (prod measurement 2026-09-21: raw Jev p50 760.5 ms). The order
// depends only on the query and the generated suggest index, which is frozen
// per deploy, so a repeated query can reuse the previous answer for free.
//
// Bounded on both axes: at most MAX_ENTRIES keys (LRU eviction) and TTL_MS of
// age. An unbounded map keyed by user input is a memory-growth surface on a
// long-lived serverless instance.

/** Cache holds the url order, not the Suggestion objects, so a stale entry
 * whose urls no longer exist is rejected at apply time instead of served. */
export type CachedOrder = readonly string[];

export const SUGGEST_CACHE_MAX_ENTRIES = 256;
export const SUGGEST_CACHE_TTL_MS = 10 * 60 * 1000;

/** Collapses the prefixes that produce an identical deterministic shortlist:
 * casing and interior whitespace never change suggestCompletions' output. */
export function normalizeSuggestQuery(query: string): string {
	return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export function suggestCacheKey(mode: string, query: string): string {
	return `${mode}:${normalizeSuggestQuery(query)}`;
}

type Entry = { order: CachedOrder; storedAt: number };

export class SuggestOrderCache {
	private readonly entries = new Map<string, Entry>();

	constructor(
		private readonly maxEntries: number = SUGGEST_CACHE_MAX_ENTRIES,
		private readonly ttlMs: number = SUGGEST_CACHE_TTL_MS,
		private readonly now: () => number = Date.now,
	) {}

	get size(): number {
		return this.entries.size;
	}

	get(key: string): CachedOrder | undefined {
		const hit = this.entries.get(key);
		if (!hit) return undefined;
		if (this.now() - hit.storedAt >= this.ttlMs) {
			this.entries.delete(key);
			return undefined;
		}
		// Re-insert so Map iteration order stays least-recently-used first.
		this.entries.delete(key);
		this.entries.set(key, hit);
		return hit.order;
	}

	set(key: string, order: CachedOrder): void {
		this.entries.delete(key);
		this.entries.set(key, { order: [...order], storedAt: this.now() });
		while (this.entries.size > this.maxEntries) {
			const oldest = this.entries.keys().next();
			if (oldest.done) break;
			this.entries.delete(oldest.value);
		}
	}

	clear(): void {
		this.entries.clear();
	}
}

/** Process-wide instance for the route. Per serverless instance, so a cold
 * start starts empty; that is a miss, never a wrong answer. */
export const suggestOrderCache = new SuggestOrderCache();
