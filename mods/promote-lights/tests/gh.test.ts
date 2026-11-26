/**
 * Unit tests for the promote PR matcher and the base list parser
 * (orchestkit#4623: a dev, qa, main flow with release/* heads).
 */

import { describe, test, expect } from "vitest";
import { isPromotePR, parseBases, buildHeadQueryArgs } from "../src/gh.ts";

describe("isPromotePR head patterns", () => {
  test("a trailing * matches the head as a prefix", () => {
    expect(isPromotePR({ number: 1, headRefOid: "a", title: "", headRefName: "release/v2026.11.10" }, "release/*")).toBe(true);
  });

  test("the prefix keeps its slash: release-notes is not release/*", () => {
    expect(isPromotePR({ number: 1, headRefOid: "a", title: "", headRefName: "release-notes" }, "release/*")).toBe(false);
  });

  test("a head without * still matches exactly", () => {
    expect(isPromotePR({ number: 1, headRefOid: "a", title: "", headRefName: "dev" }, "dev")).toBe(true);
    expect(isPromotePR({ number: 1, headRefOid: "a", title: "", headRefName: "dev-x" }, "dev")).toBe(false);
  });
});

describe("parseBases", () => {
  test("splits on commas, trims, drops empties, keeps order", () => {
    expect(parseBases(" qa , main,")).toEqual(["qa", "main"]);
  });

  test("defaults to main when unset or blank", () => {
    expect(parseBases(undefined)).toEqual(["main"]);
    expect(parseBases(" , ")).toEqual(["main"]);
  });
});

describe("buildHeadQueryArgs", () => {
  test("a pattern head drops --head and is matched client side", () => {
    const argv = buildHeadQueryArgs("release/*", "main");
    expect(argv.includes("--head")).toBe(false);
    expect(argv[argv.indexOf("--base") + 1]).toBe("main");
  });

  test("an exact head keeps --head", () => {
    const argv = buildHeadQueryArgs("development", "qa");
    expect(argv[argv.indexOf("--head") + 1]).toBe("development");
  });
});
