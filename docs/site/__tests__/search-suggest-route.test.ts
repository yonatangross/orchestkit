import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { GET } from "@/app/api/search/suggest/route";
import { suggestCompletions } from "@/lib/search-autocomplete";
import { SEARCH_SUGGEST_INDEX } from "@/lib/generated/search-suggest-index";
import { suggestOrderCache } from "@/lib/suggest-rerank-cache";

const ORIGIN = "https://orchestkit.yonyon.ai";

function req(path: string) {
	return new Request(`${ORIGIN}${path}`);
}

/** Order the route would cache for a healthy Jev answer on `query`. */
function reversedBaseUrls(query: string) {
	return suggestCompletions(query, SEARCH_SUGGEST_INDEX, 10)
		.map((s) => s.url)
		.reverse();
}

/** A healthy System One answer whose probabilities reverse `urls`. */
function jevFetchReversing(urls: string[]) {
	const probs = Object.fromEntries(urls.map((u, i) => [u, (i + 1) / urls.length]));
	return vi.fn(async () => ({
		ok: true,
		json: async () => ({
			answers: {
				pick: {
					type: "choice",
					choice: urls[urls.length - 1],
					probabilities: probs,
					confidence: 0.9,
				},
			},
		}),
	}));
}

// The route's order cache is process-wide, so one test's stored order would
// otherwise answer the next test's request for the same query.
beforeEach(() => {
	suggestOrderCache.clear();
});

afterEach(() => {
	suggestOrderCache.clear();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("GET /api/search/suggest", () => {
	it("400s on a missing query", async () => {
		const res = await GET(req("/api/search/suggest"));
		expect(res.status).toBe(400);
	});

	it("returns deterministic suggestions without any network call", async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook"));
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			items: { url: string; title: string }[];
			rankedBy: string;
			ms: number;
			estCostUsd: number;
		};
		expect(body.rankedBy).toBe("deterministic");
		expect(body.items.length).toBeGreaterThan(0);
		expect(body.items[0].url).toContain("/docs/");
		expect(typeof body.ms).toBe("number");
		expect(body.estCostUsd).toBe(0);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=off keeps deterministic order even with flag and keys set", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=off"));
		const body = (await res.json()) as { rankedBy: string; mode: string };
		expect(body.mode).toBe("off");
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("flag off ignores mode param entirely", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=llm + OPENAI_API_KEY -> llm rerank with measured cost", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		const base = suggestCompletions("hook", SEARCH_SUGGEST_INDEX, 10);
		const reversed = [...base].reverse().map((s) => s.url);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [
						{ message: { content: JSON.stringify({ order: reversed }) } },
					],
					usage: { prompt_tokens: 1000, completion_tokens: 100 },
				}),
			})),
		);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as {
			items: { url: string }[];
			rankedBy: string;
			estCostUsd: number;
		};
		expect(body.rankedBy).toBe("llm");
		expect(body.items.map((i) => i.url)).toEqual(reversed);
		// 1000 in * $0.15/M + 100 out * $0.60/M = 0.00021
		expect(body.estCostUsd).toBeCloseTo(0.00021, 6);
	});

	it("mode=llm is ignored in production even with flag and key set", async () => {
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		vi.stubEnv("TYPESAFE_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string; mode: string };
		expect(body.mode).toBe("jev");
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=llm is ignored under a nonstandard NODE_ENV (test)", async () => {
		// NODE_ENV unset or nonstandard must not reach the LLM path; vitest runs
		// with NODE_ENV=test, so no stub reproduces the nonstandard case.
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		vi.stubEnv("TYPESAFE_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string; mode: string };
		expect(body.mode).toBe("jev");
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=llm + order with a duplicate url -> deterministic fallback", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		const base = suggestCompletions("hook", SEARCH_SUGGEST_INDEX, 10);
		// One url repeated, one omitted: length still matches, so a bare
		// length check would accept it and silently drop a suggestion.
		const duped = base.map((s) => s.url);
		duped[duped.length - 1] = duped[0];
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [
						{ message: { content: JSON.stringify({ order: duped }) } },
					],
				}),
			})),
		);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
	});

	it("mode=llm + no OPENAI_API_KEY -> deterministic, zero network", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=llm + malformed LLM answer -> deterministic fallback", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: "not json at all" } }],
				}),
			})),
		);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
	});

	it("flag on + key + healthy Jev -> reranked order", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const base = suggestCompletions("hook", SEARCH_SUGGEST_INDEX, 10).map(
			(s) => s.url,
		);
		// Jev reverses the deterministic order.
		const probs = Object.fromEntries(
			base.map((u, i) => [u, (i + 1) / base.length]),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					answers: {
						pick: {
							type: "choice",
							choice: base[base.length - 1],
							probabilities: probs,
							confidence: 0.9,
						},
					},
				}),
			})),
		);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as {
			items: { url: string }[];
			rankedBy: string;
		};
		expect(body.rankedBy).toBe("jev");
		expect(body.items.map((i) => i.url)).toEqual([...base].reverse());
	});

	it("flag on + no key -> deterministic, zero network", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("flag on + Jev HTTP error -> deterministic fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 500 })),
		);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
	});

	it("flag on + malformed Jev answer -> deterministic fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ answers: { pick: { type: "noul", noul: 0.5 } } }),
			})),
		);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
	});
});

describe("GET /api/search/suggest: flag split", () => {
	it("ORK_SITE_JEV_RERANK alone does not enable the typeahead rerank", async () => {
		// The related-pages flag must not reach search. Prod 2026-09-21 had one
		// shared flag, so enabling related-pages also enabled a per-keystroke call.
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as {
			rankedBy: string;
			attempted: boolean;
			estCostUsd: number;
		};
		expect(body.rankedBy).toBe("deterministic");
		expect(body.attempted).toBe(false);
		expect(body.estCostUsd).toBe(0);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("ORK_SITE_JEV_SUGGEST alone enables the typeahead rerank", async () => {
		vi.stubEnv("ORK_SITE_JEV_RERANK", "");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const reversed = reversedBaseUrls("hook");
		vi.stubGlobal("fetch", jevFetchReversing([...reversed].reverse()));
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as {
			rankedBy: string;
			items: { url: string }[];
		};
		expect(body.rankedBy).toBe("jev");
		expect(body.items.map((i) => i.url)).toEqual(reversed);
	});
});

describe("GET /api/search/suggest: budget", () => {
	it("gives Jev the measured 1000 ms, not the 150 ms keystroke budget", async () => {
		// Prod 2026-09-21: 0/36 calls finished within 500 ms, 36/36 within 1000,
		// so the abort must not fire before a real answer could arrive.
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		// A call that only ever ends by abort, so elapsed time IS the budget.
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						(init.signal as AbortSignal).addEventListener("abort", () =>
							reject(new DOMException("aborted", "AbortError")),
						);
					}),
			),
		);
		const startedAt = Date.now();
		const res = await GET(req("/api/search/suggest?query=hook"));
		const elapsed = Date.now() - startedAt;
		const body = (await res.json()) as {
			budgetMs: number;
			fellBack: boolean;
			attempted: boolean;
			rankedBy: string;
		};
		expect(body.budgetMs).toBe(1000);
		// Well past the old 150 ms budget, and bounded so it cannot hang.
		expect(elapsed).toBeGreaterThan(900);
		expect(elapsed).toBeLessThan(2000);
		expect(body.attempted).toBe(true);
		expect(body.fellBack).toBe(true);
		expect(body.rankedBy).toBe("deterministic");
	});
});

describe("GET /api/search/suggest: order cache", () => {
	it("serves a repeated query from cache with no second upstream call", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const reversed = reversedBaseUrls("hook");
		const fetchSpy = jevFetchReversing([...reversed].reverse());
		vi.stubGlobal("fetch", fetchSpy);

		const first = (await (await GET(req("/api/search/suggest?query=hook"))).json()) as {
			rankedBy: string;
			cached: boolean;
			attempted: boolean;
			estCostUsd: number;
		};
		expect(first.rankedBy).toBe("jev");
		expect(first.cached).toBe(false);
		expect(first.attempted).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(1);

		const second = (await (await GET(req("/api/search/suggest?query=hook"))).json()) as {
			rankedBy: string;
			cached: boolean;
			attempted: boolean;
			estCostUsd: number;
			items: { url: string }[];
		};
		expect(second.cached).toBe(true);
		expect(second.rankedBy).toBe("jev");
		expect(second.attempted).toBe(false);
		expect(second.estCostUsd).toBe(0);
		expect(second.items.map((i) => i.url)).toEqual(reversed);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("hits the same cache entry for a differently cased prefix", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const reversed = reversedBaseUrls("hook");
		const fetchSpy = jevFetchReversing([...reversed].reverse());
		vi.stubGlobal("fetch", fetchSpy);

		await GET(req("/api/search/suggest?query=hook"));
		const body = (await (
			await GET(req("/api/search/suggest?query=HOOK"))
		).json()) as { cached: boolean; items: { url: string }[] };
		expect(body.cached).toBe(true);
		expect(body.items.map((i) => i.url)).toEqual(reversed);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	it("does not cache a failed rerank", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const fetchSpy = vi.fn(async () => ({ ok: false, status: 500 }));
		vi.stubGlobal("fetch", fetchSpy);
		await GET(req("/api/search/suggest?query=hook"));
		const body = (await (
			await GET(req("/api/search/suggest?query=hook"))
		).json()) as { cached: boolean; attempted: boolean };
		expect(body.cached).toBe(false);
		expect(body.attempted).toBe(true);
		expect(fetchSpy).toHaveBeenCalledTimes(2);
	});

	it("does not serve a jev order to a different mode", async () => {
		vi.stubEnv("NODE_ENV", "development");
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubEnv("OPENAI_API_KEY", "test-key");
		const reversed = reversedBaseUrls("hook");
		vi.stubGlobal("fetch", jevFetchReversing([...reversed].reverse()));
		await GET(req("/api/search/suggest?query=hook"));

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({
					choices: [{ message: { content: "not json at all" } }],
				}),
			})),
		);
		const body = (await (
			await GET(req("/api/search/suggest?query=hook&mode=llm"))
		).json()) as { cached: boolean; rankedBy: string; fellBack: boolean };
		expect(body.cached).toBe(false);
		expect(body.rankedBy).toBe("deterministic");
		expect(body.fellBack).toBe(true);
	});
});

describe("GET /api/search/suggest: honest reporting", () => {
	it("reports a timeout fallback and still bills the attempt", async () => {
		// Prod 2026-09-21: 72/72 calls aborted, and every response claimed $0.
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new DOMException("aborted", "AbortError");
			}),
		);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as {
			rankedBy: string;
			attempted: boolean;
			fellBack: boolean;
			cached: boolean;
			estCostUsd: number;
		};
		expect(body.rankedBy).toBe("deterministic");
		expect(body.attempted).toBe(true);
		expect(body.fellBack).toBe(true);
		expect(body.cached).toBe(false);
		expect(body.estCostUsd).toBeGreaterThan(0);
	});

	it("reports a malformed answer as a billed fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				json: async () => ({ answers: { pick: { type: "noul", noul: 0.5 } } }),
			})),
		);
		const body = (await (
			await GET(req("/api/search/suggest?query=hook"))
		).json()) as { fellBack: boolean; attempted: boolean; estCostUsd: number };
		expect(body.fellBack).toBe(true);
		expect(body.attempted).toBe(true);
		expect(body.estCostUsd).toBe(0.0001);
	});

	it("flag on with no key is a fallback, not a silent success, and costs nothing", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const body = (await (
			await GET(req("/api/search/suggest?query=hook"))
		).json()) as {
			fellBack: boolean;
			attempted: boolean;
			estCostUsd: number;
		};
		expect(body.fellBack).toBe(true);
		expect(body.attempted).toBe(false);
		expect(body.estCostUsd).toBe(0);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("a successful rerank reports no fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "test-key");
		const reversed = reversedBaseUrls("hook");
		vi.stubGlobal("fetch", jevFetchReversing([...reversed].reverse()));
		const body = (await (
			await GET(req("/api/search/suggest?query=hook"))
		).json()) as { fellBack: boolean; attempted: boolean; estCostUsd: number };
		expect(body.fellBack).toBe(false);
		expect(body.attempted).toBe(true);
		expect(body.estCostUsd).toBe(0.0001);
	});

	it("the flag being off reports neither an attempt nor a fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_SUGGEST", "");
		const body = (await (
			await GET(req("/api/search/suggest?query=hook"))
		).json()) as { fellBack: boolean; attempted: boolean };
		expect(body.fellBack).toBe(false);
		expect(body.attempted).toBe(false);
	});
});
