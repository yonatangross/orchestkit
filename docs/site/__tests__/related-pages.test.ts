import { describe, it, expect, vi } from "vitest";
import {
	deterministicRelated,
	scoreCandidate,
	jevRerankOrder,
	jevRerankEnabled,
	getRelatedPages,
	candidatePool,
	refKindOf,
	type RelatedCandidate,
	type RelatedItem,
} from "@/lib/related-pages";
import { jevSuggestEnabled } from "@/lib/jev-rerank";
import type { RelatedGraphData } from "@/lib/generated/related-graph";

// ── Synthetic graph fixtures ────────────────────────────────────────────────

const GRAPH: RelatedGraphData = {
	pages: {
		"/docs/reference/skills/a": { title: "Skill A", inbound: 5 },
		"/docs/reference/skills/b": { title: "Skill B", inbound: 2 },
		"/docs/reference/skills/c": { title: "Skill C", inbound: 0 },
		"/docs/reference/skills/d": { title: "Skill D", inbound: 1 },
		"/docs/reference/agents/x": { title: "Agent X", inbound: 3 },
		"/docs/reference/hooks/h": { title: "Hook H", inbound: 0 },
	},
	out: {
		"/docs/reference/skills/a": ["/docs/reference/skills/b"],
		"/docs/reference/skills/b": ["/docs/reference/skills/a"],
		"/docs/reference/skills/d": ["/docs/reference/skills/a"],
	},
};

function cand(partial: Partial<RelatedCandidate> & { url: string }): RelatedCandidate {
	return {
		title: partial.url,
		kind: "skill",
		category: null,
		tags: [],
		inbound: GRAPH.pages[partial.url]?.inbound ?? 0,
		...partial,
	};
}

describe("scoreCandidate", () => {
	const page = cand({ url: "/docs/reference/skills/a", category: "testing", tags: ["t1", "t2"] });

	it("rewards same category over different category", () => {
		const same = scoreCandidate(page, cand({ url: "/docs/reference/skills/b", category: "testing" }), GRAPH);
		const diff = scoreCandidate(page, cand({ url: "/docs/reference/skills/b", category: "backend" }), GRAPH);
		expect(same).toBeGreaterThan(diff);
	});

	it("rewards shared tags", () => {
		const tagged = scoreCandidate(page, cand({ url: "/docs/reference/skills/b", tags: ["t1", "t2"] }), GRAPH);
		const untagged = scoreCandidate(page, cand({ url: "/docs/reference/skills/b", tags: [] }), GRAPH);
		expect(tagged).toBeGreaterThan(untagged);
	});

	it("rewards mutual references more than one-way", () => {
		// a <-> b are mutual in GRAPH; d -> a is one-way only.
		const mutual = scoreCandidate(page, cand({ url: "/docs/reference/skills/b" }), GRAPH);
		const oneWay = scoreCandidate(page, cand({ url: "/docs/reference/skills/d" }), GRAPH);
		expect(mutual).toBeGreaterThan(oneWay);
	});

	it("prefers orphan targets (0 inbound) at equal relevance", () => {
		const orphan = scoreCandidate(page, cand({ url: "/docs/reference/skills/c" }), GRAPH);
		const linked = scoreCandidate(page, cand({ url: "/docs/reference/skills/d" }), GRAPH);
		// d has a one-way edge to a (+1) and inbound 1; c has no edge but is an
		// orphan (+2). The orphan bonus outweighs the one-way edge.
		expect(orphan).toBeGreaterThan(linked);
	});
});

describe("deterministicRelated", () => {
	it("returns 3-5 links and is deterministic", () => {
		const page = cand({ url: "/docs/reference/skills/a", category: "testing" });
		const pool = [
			page,
			cand({ url: "/docs/reference/skills/b", category: "testing" }),
			cand({ url: "/docs/reference/skills/c", category: "testing" }),
			cand({ url: "/docs/reference/skills/d", category: "backend" }),
			cand({ url: "/docs/reference/agents/x", kind: "agent", category: "testing" }),
			cand({ url: "/docs/reference/hooks/h", kind: "hook", category: "other" }),
		];
		const first = deterministicRelated(page, pool, GRAPH);
		const second = deterministicRelated(page, pool, GRAPH);
		expect(first.map((c) => c.url)).toEqual(second.map((c) => c.url));
		expect(first.length).toBeGreaterThanOrEqual(3);
		expect(first.length).toBeLessThanOrEqual(5);
		expect(first.some((c) => c.url === page.url)).toBe(false);
	});

	it("excludes cross-kind orphans with no other signal, caps below min", () => {
		const page = cand({ url: "/docs/reference/skills/a", kind: "skill" });
		const pool = [
			page,
			cand({ url: "/docs/reference/skills/c" }),
			cand({ url: "/docs/reference/skills/d" }),
			cand({ url: "/docs/reference/hooks/h", kind: "hook" }),
		];
		// Empty graph: the orphan hook has zero relevance signals and must not
		// outrank same-kind pages on its orphan bonus alone.
		const empty: RelatedGraphData = { pages: GRAPH.pages, out: {} };
		const picked = deterministicRelated(page, pool, empty);
		expect(picked.map((c) => c.url)).toEqual([
			"/docs/reference/skills/c", // same kind + orphan
			"/docs/reference/skills/d", // same kind
		]);
	});
});

describe("jevRerankEnabled", () => {
	it("is off by default and on for truthy values", () => {
		expect(jevRerankEnabled({} as NodeJS.ProcessEnv)).toBe(false);
		expect(jevRerankEnabled({ ORK_SITE_JEV_RERANK: "1" } as NodeJS.ProcessEnv)).toBe(true);
		expect(jevRerankEnabled({ ORK_SITE_JEV_RERANK: "true" } as NodeJS.ProcessEnv)).toBe(true);
		expect(jevRerankEnabled({ ORK_SITE_JEV_RERANK: "0" } as NodeJS.ProcessEnv)).toBe(false);
	});

	it("ignores the search-only flag, so related-pages keeps its own switch", () => {
		expect(
			jevRerankEnabled({ ORK_SITE_JEV_SUGGEST: "1" } as NodeJS.ProcessEnv),
		).toBe(false);
	});
});

describe("jevSuggestEnabled", () => {
	it("is off by default and on for truthy values", () => {
		expect(jevSuggestEnabled({} as NodeJS.ProcessEnv)).toBe(false);
		expect(jevSuggestEnabled({ ORK_SITE_JEV_SUGGEST: "1" } as NodeJS.ProcessEnv)).toBe(true);
		expect(jevSuggestEnabled({ ORK_SITE_JEV_SUGGEST: "on" } as NodeJS.ProcessEnv)).toBe(true);
		expect(jevSuggestEnabled({ ORK_SITE_JEV_SUGGEST: "0" } as NodeJS.ProcessEnv)).toBe(false);
	});

	it("ignores the related-pages flag", () => {
		expect(
			jevSuggestEnabled({ ORK_SITE_JEV_RERANK: "1" } as NodeJS.ProcessEnv),
		).toBe(false);
	});
});

describe("getRelatedPages under the search-only flag", () => {
	it("stays deterministic and makes no call when only ORK_SITE_JEV_SUGGEST is on", async () => {
		const pool = candidatePool();
		expect(pool.length).toBeGreaterThan(0);
		const page = { url: pool[0].url, title: pool[0].title };
		const fetchSpy = vi.fn();

		const withSuggestFlag = await getRelatedPages(page, {
			env: {
				ORK_SITE_JEV_SUGGEST: "1",
				TYPESAFE_API_KEY: "test-key",
			} as NodeJS.ProcessEnv,
			fetchImpl: fetchSpy as unknown as typeof fetch,
		});
		const bothFlagsOff = await getRelatedPages(page, {
			env: {} as NodeJS.ProcessEnv,
		});

		expect(withSuggestFlag.map((c) => c.url)).toEqual(
			bothFlagsOff.map((c) => c.url),
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

describe("jevRerankOrder", () => {
	const candidates: RelatedItem[] = [
		{ url: "/docs/reference/skills/b", title: "B" },
		{ url: "/docs/reference/skills/c", title: "C" },
		{ url: "/docs/reference/skills/d", title: "D" },
	];
	const page = { url: "/docs/reference/skills/a", title: "A" };

	function okFetch(probs: Record<string, number>) {
		return vi.fn(async () => ({
			ok: true,
			json: async () => ({
				model: "jev-latest",
				answers: { pick: { type: "choice", choice: "/docs/reference/skills/c", probabilities: probs, confidence: 0.9 } },
				usage: { input_tokens: 1, output_tokens: 1 },
			}),
		})) as unknown as typeof fetch;
	}

	it("reorders candidates by Jev probabilities", async () => {
		const order = await jevRerankOrder(page, candidates, {
			apiKey: "test-key",
			fetchImpl: okFetch({
				"/docs/reference/skills/b": 0.1,
				"/docs/reference/skills/c": 0.7,
				"/docs/reference/skills/d": 0.2,
			}),
		});
		expect(order).toEqual([
			"/docs/reference/skills/c",
			"/docs/reference/skills/d",
			"/docs/reference/skills/b",
		]);
	});

	it("returns null without an API key (no network call)", async () => {
		const fetchImpl = vi.fn() as unknown as typeof fetch;
		const order = await jevRerankOrder(page, candidates, { apiKey: "", fetchImpl });
		expect(order).toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("returns null on HTTP error", async () => {
		const fetchImpl = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;
		expect(await jevRerankOrder(page, candidates, { apiKey: "k", fetchImpl })).toBeNull();
	});

	it("returns null on network failure", async () => {
		const fetchImpl = vi.fn(async () => {
			throw new Error("boom");
		}) as unknown as typeof fetch;
		expect(await jevRerankOrder(page, candidates, { apiKey: "k", fetchImpl })).toBeNull();
	});

	it("returns null on a malformed answer (missing candidate probability)", async () => {
		const order = await jevRerankOrder(page, candidates, {
			apiKey: "k",
			fetchImpl: okFetch({ "/docs/reference/skills/b": 0.9 }), // c and d missing
		});
		expect(order).toBeNull();
	});

	it("returns null on a malformed answer (wrong type)", async () => {
		const fetchImpl = vi.fn(async () => ({
			ok: true,
			json: async () => ({ answers: { pick: { type: "noul", noul: 0.5 } } }),
		})) as unknown as typeof fetch;
		expect(await jevRerankOrder(page, candidates, { apiKey: "k", fetchImpl })).toBeNull();
	});
});

describe("site data bindings", () => {
	it("classifies reference page URLs", () => {
		expect(refKindOf("/docs/reference/skills/doctor")).toBe("skill");
		expect(refKindOf("/docs/reference/agents/test-generator")).toBe("agent");
		expect(refKindOf("/docs/reference/hooks/pre-tool-use")).toBe("hook");
		expect(refKindOf("/docs/reference/hooks/spotlights/stop-pipeline")).toBe("hook");
		expect(refKindOf("/docs/guides/cc-adoption")).toBeNull();
		expect(refKindOf("/docs/reference")).toBeNull();
	});

	it("builds a candidate for every reference page with real metadata", () => {
		const pool = candidatePool();
		expect(pool.length).toBeGreaterThan(100);
		const skill = pool.find((c) => c.url === "/docs/reference/skills/doctor");
		expect(skill?.kind).toBe("skill");
		expect(skill?.tags.length).toBeGreaterThan(0);
		const agent = pool.find((c) => c.url === "/docs/reference/agents/test-generator");
		expect(agent?.kind).toBe("agent");
		expect(agent?.category).toBeTruthy();
		const hook = pool.find((c) => c.url === "/docs/reference/hooks/pre-tool-use");
		expect(hook?.kind).toBe("hook");
		expect(hook?.category).toBe("tools"); // hook phase id
	});
});
