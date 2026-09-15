/**
 * Tests for classify.ts - pure classifier logic.
 */

import { describe, test, expect } from "vitest";
import {
  classifyCheckRun,
  aggregateLights,
  isPassing,
  matchAndClassify,
  type CheckRun,
} from "../src/classify.ts";

describe("classifyCheckRun", () => {
  test("success is green", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "success" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("green");
  });

  test("failure is red", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "failure" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("red");
  });

  test("cancelled is its own bucket", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "cancelled" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("cancelled");
  });

  test("queued is yellow", () => {
    const run: CheckRun = { name: "ci", status: "queued", conclusion: null };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("yellow");
  });

  test("in_progress is yellow", () => {
    const run: CheckRun = { name: "ci", status: "in_progress", conclusion: null };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("yellow");
  });

  test("timed_out is red", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "timed_out" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("red");
  });

  test("action_required is red", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "action_required" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("red");
  });

  test("skipped is yellow", () => {
    const run: CheckRun = { name: "ci", status: "completed", conclusion: "skipped" };
    const result = classifyCheckRun(run);
    expect(result.color).toBe("yellow");
  });
});

describe("aggregateLights", () => {
  test("counts by color", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "green", conclusion: "success" },
      { name: "c", color: "yellow", conclusion: null },
      { name: "d", color: "cancelled", conclusion: "cancelled" },
    ] as const;

    const counts = aggregateLights(lights);
    expect(counts.green).toBe(2);
    expect(counts.yellow).toBe(1);
    expect(counts.red).toBe(0);
    expect(counts.cancelled).toBe(1);
  });
});

describe("isPassing", () => {
  test("all green is passing", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "green", conclusion: "success" },
    ] as const;
    expect(isPassing(lights)).toBe(true);
  });

  test("green and yellow is passing (in progress)", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "yellow", conclusion: null },
    ] as const;
    expect(isPassing(lights)).toBe(true);
  });

  test("cancelled is never pass", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "cancelled", conclusion: "cancelled" },
    ] as const;
    expect(isPassing(lights)).toBe(false);
  });

  test("red is not pass", () => {
    const lights = [
      { name: "a", color: "red", conclusion: "failure" },
    ] as const;
    expect(isPassing(lights)).toBe(false);
  });

  test("empty lights is not pass", () => {
    expect(isPassing([])).toBe(false);
  });
});

describe("matchAndClassify", () => {
  test("prefers non-skipped run for duplicate names", () => {
    const required = ["ci"];
    const runs: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "skipped" },
      { name: "ci", status: "completed", conclusion: "success" },
    ];

    const result = matchAndClassify(required, runs);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("green");
  });

  test("uses skipped if no non-skipped available", () => {
    const required = ["ci"];
    const runs: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "skipped" },
    ];

    const result = matchAndClassify(required, runs);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("yellow");
  });

  test("missing context is red", () => {
    const required = ["ci"];
    const runs: CheckRun[] = [];

    const result = matchAndClassify(required, runs);
    expect(result).toHaveLength(1);
    expect(result[0].color).toBe("red");
    expect(result[0].name).toBe("ci");
  });

  test("classifies multiple contexts", () => {
    const required = ["lint", "test", "build"];
    const runs: CheckRun[] = [
      { name: "lint", status: "completed", conclusion: "success" },
      { name: "test", status: "in_progress", conclusion: null },
      { name: "build", status: "completed", conclusion: "cancelled" },
    ];

    const result = matchAndClassify(required, runs);
    expect(result).toHaveLength(3);
    expect(result.find((l) => l.name === "lint")?.color).toBe("green");
    expect(result.find((l) => l.name === "test")?.color).toBe("yellow");
    expect(result.find((l) => l.name === "build")?.color).toBe("cancelled");
  });
});
