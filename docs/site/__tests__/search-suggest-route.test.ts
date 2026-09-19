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
		};
		expect(body.rankedBy).toBe("deterministic");
		expect(body.items.length).toBeGreaterThan(0);
		expect(body.items[0].url).toContain("/docs/");
		expect(fetchSpy).not.toHaveBeenCalled();
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
