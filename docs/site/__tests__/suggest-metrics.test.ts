import { describe, it, expect } from "vitest";
import {
	createSuggestStats,
	percentile,
	recordSuggestSample,
} from "@/lib/suggest-metrics";

describe("percentile", () => {
	it("returns 0 on empty input", () => {
		expect(percentile([], 50)).toBe(0);
		expect(percentile([], 95)).toBe(0);
	});

	it("computes nearest-rank p50 and p95", () => {
		const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
		expect(percentile(values, 50)).toBe(50);
		expect(percentile(values, 95)).toBe(100);
		expect(percentile(values, 10)).toBe(10);
	});

	it("does not mutate the input order", () => {
		const values = [90, 10, 50];
		percentile(values, 50);
		expect(values).toEqual([90, 10, 50]);
	});
});

describe("recordSuggestSample", () => {
	const ranked = { costUsd: 0.0001, fellBack: false, cached: false };

	it("accumulates latency, count and cost", () => {
		let stats = createSuggestStats();
		stats = recordSuggestSample(stats, 40, ranked);
		stats = recordSuggestSample(stats, 60, { ...ranked, costUsd: 0.0002 });
		expect(stats.latencies).toEqual([40, 60]);
		expect(stats.requests).toBe(2);
		expect(stats.costUsd).toBeCloseTo(0.0003, 6);
	});

	it("returns a new object rather than mutating", () => {
		const stats = createSuggestStats();
		const next = recordSuggestSample(stats, 10, { ...ranked, costUsd: 0 });
		expect(stats.requests).toBe(0);
		expect(next.requests).toBe(1);
	});

	it("counts fallbacks separately from requests", () => {
		// The footer must distinguish "Jev agreed with the deterministic order"
		// from "Jev never answered"; request count alone cannot.
		let stats = createSuggestStats();
		stats = recordSuggestSample(stats, 40, ranked);
		stats = recordSuggestSample(stats, 1000, {
			costUsd: 0.0001,
			fellBack: true,
			cached: false,
		});
		expect(stats.requests).toBe(2);
		expect(stats.fallbacks).toBe(1);
		// A fallback still cost money: that is the whole point of the field.
		expect(stats.costUsd).toBeCloseTo(0.0002, 6);
	});

	it("counts cache hits, which are free", () => {
		let stats = createSuggestStats();
		stats = recordSuggestSample(stats, 8, {
			costUsd: 0,
			fellBack: false,
			cached: true,
		});
		expect(stats.cacheHits).toBe(1);
		expect(stats.fallbacks).toBe(0);
		expect(stats.costUsd).toBe(0);
	});
});
