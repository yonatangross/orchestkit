import { describe, expect, it } from "vitest";
import type { ChangelogEntry } from "@/lib/generated/changelog-data";
import { CHANGELOG_ENTRIES } from "@/lib/generated/changelog-data";
import {
  CHANGELOG_CATEGORIES,
  HOW_TO_READ,
  SECTION_HEADING_CATEGORY,
  TAG_BG,
  groupReleaseSections,
  isProductChangelogItem,
  parseChangelogItem,
  pickWhatsNewPreview,
  releaseSectionMix,
  sectionCategory,
} from "@/lib/changelog-format";

describe("changelog format", () => {
  it("tags use theme tokens, not raw Tailwind 400 hues", () => {
    const joined = Object.values(TAG_BG).join(" ");
    expect(joined).not.toMatch(/text-(indigo|amber|cyan|red|orange)-400/);
    expect(TAG_BG.added).toContain("text-fd-primary");
    expect(TAG_BG.fixed).toContain("--yy-george-cool-text");
    expect(TAG_BG.deprecated).toContain("--yy-george-warm-text");
  });

  it("treats conventional plumbing prefixes as non-product", () => {
    expect(isProductChangelogItem("**build:** stamp manifests")).toBe(false);
    expect(isProductChangelogItem("**ci:** skip pattern")).toBe(false);
    expect(isProductChangelogItem("**skills:** relative paths")).toBe(true);
    expect(isProductChangelogItem("retire unused tables")).toBe(true);
  });

  it("unpacks a conventional-commit bullet into title, refs, and rationale", () => {
    const parsed = parseChangelogItem(
      "**build:** stamp harness manifests from package.json, close [#2528](https://github.com/yonatangross/orchestkit/issues/2528) ([#3946](https://github.com/yonatangross/orchestkit/issues/3946)) ([4d4f547](https://github.com/yonatangross/orchestkit/commit/4d4f547a799ce2c77b38ac65940cb23dbb24f837))",
    );
    expect(parsed.scope).toBe("build");
    expect(parsed.title).toBe("stamp harness manifests from package.json");
    expect(parsed.rationale).toMatch(/plumbing/i);
    expect(parsed.issues.map((r) => r.label)).toEqual(["#2528", "#3946"]);
    expect(parsed.shas[0]?.label).toBe("4d4f547");
  });

  it("summarizes a release mix in legend categories, merging same-category headings", () => {
    const mix = releaseSectionMix({
      version: "10.0.0-alpha.83",
      date: "2026-09-06",
      compareUrl: "",
      sections: [
        { type: "changed", heading: "Miscellaneous", items: ["a"] },
        { type: "changed", heading: "Code Refactoring", items: ["b", "c"] },
        { type: "changed", heading: "Documentation", items: ["d"] },
      ],
    });
    expect(mix).toEqual([
      { category: "changed", label: "Changed", count: 3 },
      { category: "docs", label: "Docs", count: 1 },
    ]);
  });

  it("pins every release-please and Keep a Changelog heading to one legend category", () => {
    expect(SECTION_HEADING_CATEGORY).toEqual({
      features: "added",
      added: "added",
      "bug fixes": "fixed",
      fixed: "fixed",
      miscellaneous: "changed",
      "code refactoring": "changed",
      performance: "changed",
      "ci/cd": "changed",
      changed: "changed",
      documentation: "docs",
      removed: "removed",
      deprecated: "deprecated",
      security: "security",
    });
    expect(sectionCategory({ type: "fixed", heading: "Bug Fixes" })).toBe("fixed");
    expect(sectionCategory({ type: "changed", heading: " Documentation " })).toBe("docs");
    expect(sectionCategory({ type: "added", heading: "Something New" })).toBe("added");
  });

  it("legend lists every category, and every shipped heading maps into it", () => {
    expect(HOW_TO_READ.map((row) => row.label)).toEqual(
      Object.values(CHANGELOG_CATEGORIES).map((meta) => meta.label),
    );
    const legendLabels = new Set(HOW_TO_READ.map((row) => row.label));
    const legendGlyphs = new Set(HOW_TO_READ.map((row) => row.glyph));
    for (const entry of CHANGELOG_ENTRIES) {
      for (const group of groupReleaseSections(entry)) {
        expect(legendLabels).toContain(group.label);
        expect(legendGlyphs).toContain(group.glyph);
      }
    }
  });

  it("gives a Bug Fixes release the Fixed glyph, whatever the commit scope", () => {
    const [group] = groupReleaseSections({
      version: "10.0.0-beta.95",
      date: "2026-09-25",
      compareUrl: "",
      sections: [
        {
          type: "fixed",
          heading: "Bug Fixes",
          items: ["**promote-lights:** match only real promote PRs into main"],
        },
      ],
    });
    expect(group).toMatchObject({ category: "fixed", label: "Fixed", glyph: "✅" });
    expect(Object.keys(parseChangelogItem(group!.items[0]!))).not.toContain("glyph");
  });

  it("drops a leading emoji from commit text so it cannot contradict the legend", () => {
    expect(parseChangelogItem("**skills:** 🎯 relative paths").title).toBe("relative paths");
    expect(parseChangelogItem("⚠️ retire unused tables").title).toBe("retire unused tables");
  });

  it("styles every legend category", () => {
    expect(Object.keys(TAG_BG).sort()).toEqual(Object.keys(CHANGELOG_CATEGORIES).sort());
  });

  it("skips plumbing-only releases when picking What's new", () => {
    const entries: ChangelogEntry[] = [
      {
        version: "10.0.0-alpha.85",
        date: "2026-09-06",
        compareUrl: "",
        sections: [
          {
            type: "changed",
            heading: "Miscellaneous",
            items: ["**build:** stamp manifests"],
          },
        ],
      },
      {
        version: "10.0.0-alpha.83",
        date: "2026-09-06",
        compareUrl: "",
        sections: [
          {
            type: "changed",
            heading: "Code Refactoring",
            items: ["**skills:** relative paths"],
          },
          {
            type: "fixed",
            heading: "Bug Fixes",
            items: ["**ci:** fail absent input"],
          },
        ],
      },
    ];
    const preview = pickWhatsNewPreview(entries, 3);
    expect(preview?.entry.version).toBe("10.0.0-alpha.83");
    expect(preview?.items).toHaveLength(1);
    expect(preview?.items[0]?.item).toContain("relative paths");
  });
});
