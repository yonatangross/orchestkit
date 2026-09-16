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

  test("pending or in progress is not pass (GH-4177 class)", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "yellow", conclusion: null },
    ] as const;
    expect(isPassing(lights)).toBe(false);
  });

  test("skipped is not pass", () => {
    const lights = [
      { name: "a", color: "green", conclusion: "success" },
      { name: "b", color: "yellow", conclusion: "skipped" },
    ] as const;
    expect(isPassing(lights)).toBe(false);
  });

  test("all skipped is not pass", () => {
    const lights = [
      { name: "a", color: "yellow", conclusion: "skipped" },
      { name: "b", color: "yellow", conclusion: "skipped" },
    ] as const;
    expect(isPassing(lights)).toBe(false);
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

  test("failure first, then green reruns, is red regardless of API order", () => {
    const required = ["Build"];
    const failureFirst: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "failure" },
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];
    const failureLast: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "failure" },
    ];

    expect(matchAndClassify(required, failureFirst)[0].color).toBe("red");
    expect(matchAndClassify(required, failureLast)[0].color).toBe("red");
  });

  test("timed_out first, then green rerun, is red in both API orders", () => {
    const required = ["Build"];
    const timedOutFirst: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "timed_out" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];
    const timedOutLast: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "timed_out" },
    ];

    expect(matchAndClassify(required, timedOutFirst)[0].color).toBe("red");
    expect(matchAndClassify(required, timedOutLast)[0].color).toBe("red");
  });

  test("cancelled keeps its own bucket and never reads as a pass", () => {
    const required = ["Build"];
    // Cancelled alongside greens: no red run exists, but the cancellation
    // is a missing verdict, so the bucket is cancelled, not green, in both
    // API orders.
    const cancelledThenGreen: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "cancelled" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];
    const greenThenCancelled: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "cancelled" },
    ];
    // Cancelled alongside a failure: the failure still rules.
    const cancelledThenFailure: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "cancelled" },
      { name: "Build", status: "completed", conclusion: "failure" },
    ];

    expect(matchAndClassify(required, cancelledThenGreen)[0].color).toBe("cancelled");
    expect(matchAndClassify(required, greenThenCancelled)[0].color).toBe("cancelled");
    expect(matchAndClassify(required, cancelledThenFailure)[0].color).toBe("red");
    expect(isPassing(matchAndClassify(required, cancelledThenGreen))).toBe(false);
  });

  test("beta.34 real shape: three required contexts all skipped is not passing", () => {
    // Real required context names from branch protection on main. At the
    // beta.34 shape all three came back completed with conclusion skipped,
    // and the old all-yellow-is-passing logic reported that as passing.
    const required = ["Build", "Static Analysis", "Unit Tests (node 22)"];
    const runs: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "skipped" },
      { name: "Static Analysis", status: "completed", conclusion: "skipped" },
      { name: "Unit Tests (node 22)", status: "completed", conclusion: "skipped" },
    ];

    const lights = matchAndClassify(required, runs);
    expect(lights).toHaveLength(3);
    expect(lights.every((l) => l.color === "yellow")).toBe(true);
    expect(isPassing(lights)).toBe(false);
  });

  test("missing required context is not passing", () => {
    const required = ["Build", "Static Analysis"];
    const runs: CheckRun[] = [
      { name: "Static Analysis", status: "completed", conclusion: "success" },
    ];

    const lights = matchAndClassify(required, runs);
    expect(lights.find((l) => l.name === "Build")?.color).toBe("red");
    expect(isPassing(lights)).toBe(false);
  });

  test("a failing rerun under a green name is not passing", () => {
    const required = ["Build"];
    const runs: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "failure" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];

    expect(isPassing(matchAndClassify(required, runs))).toBe(false);
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
