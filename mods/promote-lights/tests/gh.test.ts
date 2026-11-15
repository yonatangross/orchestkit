/**
 * promote PR matching (orchestkit#4623): a trailing * in PROMOTE_HEAD is a
 * prefix, anything else is an exact head name.
 */

import { describe, test, expect } from "vitest";
import { isPromotePR } from "../src/gh.ts";

describe("isPromotePR with a release/* head pattern (orchestkit#4623)", () => {
  test("matches a release/ head by prefix", () => {
    expect(isPromotePR({ number: 1, headRefOid: "a", title: "t", headRefName: "release/v2026.11.10" }, "release/*")).toBe(true);
  });

  test("does not match a head that only starts with the same letters", () => {
    expect(isPromotePR({ number: 2, headRefOid: "a", title: "t", headRefName: "release-notes" }, "release/*")).toBe(false);
  });

  test("an exact head still matches exactly", () => {
    expect(isPromotePR({ number: 3, headRefOid: "a", title: "t", headRefName: "dev" }, "dev")).toBe(true);
    expect(isPromotePR({ number: 4, headRefOid: "a", title: "t", headRefName: "dev2" }, "dev")).toBe(false);
  });
});
