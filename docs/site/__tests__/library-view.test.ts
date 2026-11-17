import { describe, expect, it } from "vitest";
import { LIBRARY_COUNTS, LIBRARY_ITEMS } from "@/lib/generated/library-data";
import {
  hooksNote,
  hookEventSlug,
  libraryItemHref,
  libraryItemSearchText,
  parseKindParam,
  parseStationParam,
  rowMatches,
} from "@/lib/library-view";
import hooksMeta from "@/content/docs/reference/hooks/meta.json";

describe("library-view", () => {
  it("turns a hook event into its page slug", () => {
    expect(hookEventSlug("PreToolUse")).toBe("pre-tool-use");
    expect(hookEventSlug("SessionStart")).toBe("session-start");
    expect(hookEventSlug("PostToolUseFailure")).toBe("post-tool-use-failure");
  });

  it("points every hook at an event page that exists", () => {
    const pages = new Set(hooksMeta.pages);
    for (const item of LIBRARY_ITEMS) {
      if (item.kind !== "hook") continue;
      const page = libraryItemHref(item).split("#")[0].split("/").pop() ?? "";
      expect(pages.has(page), `${item.id} -> ${page}`).toBe(true);
    }
  });

  it("gives every library item a unique href", () => {
    const hrefs = LIBRARY_ITEMS.map(libraryItemHref);
    expect(new Set(hrefs).size).toBe(LIBRARY_ITEMS.length);
    expect(LIBRARY_ITEMS.length).toBe(LIBRARY_COUNTS.items);
  });

  it("the hooks note carries LIBRARY_COUNTS numbers, never typed ones", () => {
    expect(hooksNote(LIBRARY_COUNTS)).toBe(
      `${LIBRARY_COUNTS.hooks} hooks, plus ${LIBRARY_COUNTS.skillScopedHooks} that run inside ${LIBRARY_COUNTS.skillsWithHooks} skills.`,
    );
    expect(hooksNote({ hooks: 151, skillScopedHooks: 12, skillsWithHooks: 10 })).toBe(
      "151 hooks, plus 12 that run inside 10 skills.",
    );
  });

  it("ignores unknown station and kind params", () => {
    expect(parseStationParam("plan")).toBe("plan");
    expect(parseStationParam("nope")).toBeNull();
    expect(parseKindParam("hook")).toBe("hook");
    expect(parseKindParam("x")).toBe("all");
  });

  it("filters by kind, station and query together", () => {
    const row = { kind: "skill", station: "plan", text: "explore maps the codebase" };
    expect(rowMatches(row, { kind: "all", station: null, query: "" })).toBe(true);
    expect(rowMatches(row, { kind: "hook", station: null, query: "" })).toBe(false);
    expect(rowMatches(row, { kind: "skill", station: "build", query: "" })).toBe(false);
    expect(rowMatches(row, { kind: "all", station: "plan", query: " CODEBASE " })).toBe(true);
    expect(rowMatches(row, { kind: "all", station: null, query: "verify" })).toBe(false);
    const found = LIBRARY_ITEMS.find((i) => i.name === "implement" && i.kind === "skill");
    expect(found && libraryItemSearchText(found)).toContain("implement");
  });
});
