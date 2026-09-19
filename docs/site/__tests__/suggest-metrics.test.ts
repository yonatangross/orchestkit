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
	it("accumulates latency, count and cost", () => {
		let stats = createSuggestStats();
		stats = recordSuggestSample(stats, 40, 0.0001);
		stats = recordSuggestSample(stats, 60, 0.0002);
		expect(stats.latencies).toEqual([40, 60]);
		expect(stats.requests).toBe(2);
		expect(stats.costUsd).toBeCloseTo(0.0003, 6);
	});

	it("returns a new object rather than mutating", () => {
		const stats = createSuggestStats();
		const next = recordSuggestSample(stats, 10, 0);
		expect(stats.requests).toBe(0);
		expect(next.requests).toBe(1);
	});
});
