import { describe, it, expect, vi, afterEach } from "vitest";
import { GET } from "@/app/api/search/suggest/route";
import { suggestCompletions } from "@/lib/search-autocomplete";
import { SEARCH_SUGGEST_INDEX } from "@/lib/generated/search-suggest-index";

const ORIGIN = "https://orchestkit.yonyon.ai";

function req(path: string) {
	return new Request(`${ORIGIN}${path}`);
}

afterEach(() => {
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "");
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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

	it("mode=llm + no OPENAI_API_KEY -> deterministic, zero network", async () => {
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
		vi.stubEnv("OPENAI_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook&mode=llm"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("mode=llm + malformed LLM answer -> deterministic fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
		vi.stubEnv("TYPESAFE_API_KEY", "");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);
		const res = await GET(req("/api/search/suggest?query=hook"));
		const body = (await res.json()) as { rankedBy: string };
		expect(body.rankedBy).toBe("deterministic");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("flag on + Jev HTTP error -> deterministic fallback", async () => {
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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
		vi.stubEnv("ORK_SITE_JEV_RERANK", "1");
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
