/**
 * Tests for required.ts - required contexts union.
 */

import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  parseProtection,
  parseRulesets,
  computeRequiredUnion,
} from "../src/required.ts";
import { matchAndClassify, isPassing } from "../src/classify.ts";

/**
 * REAL rulesets response, captured verbatim 2026-09-16 with:
 *   gh api repos/github/docs/rules/branches/main
 *
 * Provenance: orchestkit itself has zero rulesets (its live response to
 * gh api repos/yonatangross/orchestkit/rules/branches/main is a top-level
 * empty array, `[]`, saved alongside as rulesets-orchestkit-main-empty.json),
 * so a response that actually contains required_status_checks rules was
 * captured from a public repo instead. This fixture is NOT hand-written:
 * the bug this file guards against (GH-4165 review P1-3) was that the
 * parser expected {rules: []} while the real API returns a top-level
 * ARRAY, so every ruleset-required context was silently dropped and a
 * fixture shaped like what the code expected could never catch it.
 */
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const REAL_RULESETS = readFileSync(
  join(FIXTURES_DIR, "rulesets-branch-main-real.json"),
  "utf8"
);
const ORCHESTKIT_EMPTY = readFileSync(
  join(FIXTURES_DIR, "rulesets-orchestkit-main-empty.json"),
  "utf8"
);

describe("parseProtection", () => {
  test("extracts contexts from valid response", () => {
    const body = JSON.stringify({
      required_status_checks: {
        contexts: ["ci", "lint"],
      },
    });
    expect(parseProtection(body)).toEqual(["ci", "lint"]);
  });

  test("drops 404 body starting with brace", () => {
    const body = '{"message":"Not Found"}';
    expect(parseProtection(body)).toEqual([]);
  });

  test("handles missing required_status_checks", () => {
    const body = "{}";
    expect(parseProtection(body)).toEqual([]);
  });

  test("handles invalid JSON", () => {
    expect(parseProtection("not json")).toEqual([]);
  });
});

describe("parseRulesets", () => {
  test("extracts contexts from ruleset parameters", () => {
    const body = JSON.stringify({
      rules: [
        {
          type: "required_status_checks",
          parameters: {
            required_status_checks: [{ context: "ci" }, { context: "test" }],
          },
        },
      ],
    });
    expect(parseRulesets(body)).toEqual(["ci", "test"]);
  });

  test("drops 404 body starting with brace", () => {
    const body = '{"message":"Not Found"}';
    expect(parseRulesets(body)).toEqual([]);
  });

  test("handles rules without parameters", () => {
    const body = JSON.stringify({
      rules: [{ type: "some_other_rule" }],
    });
    expect(parseRulesets(body)).toEqual([]);
  });

  test("handles empty rules array", () => {
    const body = JSON.stringify({ rules: [] });
    expect(parseRulesets(body)).toEqual([]);
  });

  test("REAL fixture: parses a TOP-LEVEL ARRAY and extracts rulest-required contexts", () => {
    // The real API response is a bare array, not {rules: []}. The old
    // parser read parsed.rules off the array object, got undefined, and
    // returned [] for every real response: fail-open by erasure.
    const contexts = parseRulesets(REAL_RULESETS);
    expect(contexts.length).toBeGreaterThanOrEqual(30);
    // Contexts taken verbatim from the captured response.
    expect(contexts).toContain("article-api");
    expect(contexts).toContain("content-render");
  });

  test("REAL fixture: orchestkit's own live response (empty array) parses to no contexts", () => {
    // gh api repos/yonatangross/orchestkit/rules/branches/main, verbatim.
    expect(ORCHESTKIT_EMPTY).toBe("[]\n");
    expect(parseRulesets(ORCHESTKIT_EMPTY)).toEqual([]);
  });

  test("FAIL-OPEN GUARD: a ruleset-required context pending means NOT passing", () => {
    // Take a real ruleset-required context from the captured response,
    // pretend branch protection also requires it, and feed a check-runs
    // set where that context is still in_progress. The light must read
    // not-passing: a monitor that goes green while a required check it
    // can see is pending is the GH-4177 failure class.
    const rulesetContexts = parseRulesets(REAL_RULESETS);
    const ctx = rulesetContexts[0];
    expect(ctx).toBeTruthy();

    const protection = JSON.stringify({
      required_status_checks: { contexts: [ctx] },
    });
    const required = computeRequiredUnion(protection, REAL_RULESETS);
    expect(required).toContain(ctx);

    // Inline the full pipeline the hook runs (matchAndClassify + isPassing)
    // so this test pins the composed behavior, not just one function.
    const lights = matchAndClassify(required, [
      { name: ctx, status: "in_progress", conclusion: null },
    ]);
    expect(lights.find((l) => l.name === ctx)?.color).toBe("yellow");
    expect(isPassing(lights)).toBe(false);
  });
});

describe("computeRequiredUnion", () => {
  test("unions and deduplicates contexts", () => {
    const protection = JSON.stringify({
      required_status_checks: { contexts: ["ci", "lint"] },
    });
    const rulesets = JSON.stringify({
      rules: [
        {
          parameters: {
            required_status_checks: [{ context: "lint" }, { context: "build" }],
          },
        },
      ],
    });

    const result = computeRequiredUnion(protection, rulesets);
    expect(result.sort()).toEqual(["build", "ci", "lint"]);
  });

  test("handles both empty", () => {
    expect(computeRequiredUnion("", "")).toEqual([]);
  });

  test("handles one empty", () => {
    const protection = JSON.stringify({
      required_status_checks: { contexts: ["ci"] },
    });
    expect(computeRequiredUnion(protection, "")).toEqual(["ci"]);
  });

  test("refuses green when union is empty (brief line 11)", () => {
    const result = computeRequiredUnion("", "");
    expect(result).toEqual([]);
    // Caller must check and not show all-green when empty
  });
});
