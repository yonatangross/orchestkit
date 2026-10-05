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
import { buildStatusLine } from "../src/pane.ts";

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
  test("a skipped run next to a success IS passing (acct-nir-request-4)", () => {
    // Measured on Nir's Windows setup (5 screenshots, 2026-10-05): a rerun
    // leaves a skipped sibling under the same check name, and worst-wins
    // across ALL runs read [skipped, success] as yellow forever, so a green
    // bundle printed "3 yellow". Skipped is a non-verdict (path filters,
    // concurrency skips) and GitHub itself treats a skipped required check
    // as satisfied: a success under the name now settles it green. This
    // deliberately narrows the old GH-4177 skipped carve-out: a failure,
    // a cancellation or a pending run beside a success still rules (see the
    // order-independence tests below).
    const required = ["ci"];
    const skippedFirst: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "skipped" },
      { name: "ci", status: "completed", conclusion: "success" },
    ];
    const skippedLast: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "success" },
      { name: "ci", status: "completed", conclusion: "skipped" },
    ];

    expect(matchAndClassify(required, skippedFirst)[0].color).toBe("green");
    expect(matchAndClassify(required, skippedLast)[0].color).toBe("green");
    expect(isPassing(matchAndClassify(required, skippedFirst))).toBe(true);
    expect(isPassing(matchAndClassify(required, skippedLast))).toBe(true);
  });

  test("three names each with one success and one skipped print 0 yellow", () => {
    // The measured fixture, Nir's real shape: every check name has two runs
    // on the head, one success and one skipped, and the line must read all
    // green with no yellow segment.
    const required = ["Build", "Static Analysis", "Unit Tests (node 22)"];
    const runs: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "skipped" },
      { name: "Static Analysis", status: "completed", conclusion: "skipped" },
      { name: "Static Analysis", status: "completed", conclusion: "success" },
      { name: "Unit Tests (node 22)", status: "completed", conclusion: "success" },
      { name: "Unit Tests (node 22)", status: "completed", conclusion: "skipped" },
    ];

    const lights = matchAndClassify(required, runs);
    expect(lights.map((l) => l.color)).toEqual(["green", "green", "green"]);
    expect(isPassing(lights)).toBe(true);

    const line = buildStatusLine(9999, lights, "CLEAN", false);
    expect(line).toContain("3 green");
    expect(line).not.toContain("yellow");
  });

  test("a skipped run beside a failure or a pending run does not soften it", () => {
    // Only a success demotes the skipped sibling. With no success under the
    // name, skipped keeps losing to every real verdict.
    const required = ["ci"];
    const failureBesideSkipped: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "failure" },
      { name: "ci", status: "completed", conclusion: "skipped" },
    ];
    const pendingBesideSkipped: CheckRun[] = [
      { name: "ci", status: "in_progress", conclusion: null },
      { name: "ci", status: "completed", conclusion: "skipped" },
    ];
    const successFailureSkipped: CheckRun[] = [
      { name: "ci", status: "completed", conclusion: "success" },
      { name: "ci", status: "completed", conclusion: "skipped" },
      { name: "ci", status: "completed", conclusion: "failure" },
    ];

    expect(matchAndClassify(required, failureBesideSkipped)[0].color).toBe("red");
    expect(matchAndClassify(required, pendingBesideSkipped)[0].color).toBe("yellow");
    expect(matchAndClassify(required, successFailureSkipped)[0].color).toBe("red");
    expect(isPassing(matchAndClassify(required, failureBesideSkipped))).toBe(false);
  });

  test("ORDER-INDEPENDENCE: [success, in_progress] and [in_progress, success] both not passing", () => {
    const required = ["Build"];
    const successFirst: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "in_progress", conclusion: null },
    ];
    const successLast: CheckRun[] = [
      { name: "Build", status: "in_progress", conclusion: null },
      { name: "Build", status: "completed", conclusion: "success" },
    ];

    const first = matchAndClassify(required, successFirst);
    const last = matchAndClassify(required, successLast);
    // Same verdict in both orders: ANY non-success run blocks the pass.
    expect(first[0].color).toBe("yellow");
    expect(last[0].color).toBe("yellow");
    expect(isPassing(first)).toBe(false);
    expect(isPassing(last)).toBe(false);
  });

  test("ORDER-INDEPENDENCE: [success, failure] and [failure, success] both not passing", () => {
    const required = ["Build"];
    const successFirst: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "failure" },
    ];
    const successLast: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "failure" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];

    const first = matchAndClassify(required, successFirst);
    const last = matchAndClassify(required, successLast);
    expect(first[0].color).toBe("red");
    expect(last[0].color).toBe("red");
    expect(isPassing(first)).toBe(false);
    expect(isPassing(last)).toBe(false);
  });

  test("ORDER-INDEPENDENCE: [success, success] is passing", () => {
    const required = ["Build"];
    const runs: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "completed", conclusion: "success" },
    ];

    const lights = matchAndClassify(required, runs);
    expect(lights[0].color).toBe("green");
    expect(isPassing(lights)).toBe(true);
  });

  test("ORDER-INDEPENDENCE: every permutation of a mixed set gives the same verdict", () => {
    // Three runs under one name: green, pending, failed. All 6 orders
    // must agree on not-passing, and the representative must be red.
    const base: CheckRun[] = [
      { name: "Build", status: "completed", conclusion: "success" },
      { name: "Build", status: "in_progress", conclusion: null },
      { name: "Build", status: "completed", conclusion: "failure" },
    ];
    const permutations: CheckRun[][] = [
      base,
      [base[0], base[2], base[1]],
      [base[1], base[0], base[2]],
      [base[1], base[2], base[0]],
      [base[2], base[0], base[1]],
      [base[2], base[1], base[0]],
    ];

    for (const runs of permutations) {
      const lights = matchAndClassify(["Build"], runs);
      expect(lights[0].color).toBe("red");
      expect(isPassing(lights)).toBe(false);
    }
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
