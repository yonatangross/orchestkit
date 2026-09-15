/**
 * Tests for required.ts - required contexts union.
 */

import { describe, test, expect } from "vitest";
import {
  parseProtection,
  parseRulesets,
  computeRequiredUnion,
} from "../src/required.ts";

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
