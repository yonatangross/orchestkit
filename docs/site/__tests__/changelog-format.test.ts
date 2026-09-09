import { describe, expect, it } from "vitest";
import type { ChangelogEntry } from "@/lib/generated/changelog-data";
import {
  TAG_BG,
  isProductChangelogItem,
  parseChangelogItem,
  pickWhatsNewPreview,
  releaseMixMermaid,
  releaseSectionMix,
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

  it("builds a mermaid mix from section headings", () => {
    const chart = releaseMixMermaid({
      version: "10.0.0-alpha.83",
      date: "2026-09-06",
      compareUrl: "",
      sections: [
        { type: "changed", heading: "Miscellaneous", items: ["a"] },
        { type: "changed", heading: "Code Refactoring", items: ["b"] },
      ],
    });
    expect(chart).toContain("flowchart LR");
    expect(chart).toContain("Miscellaneous");
    expect(chart).toContain("Code Refactoring");
  });

  it("summarizes a release mix as heading counts", () => {
    const mix = releaseSectionMix({
      version: "10.0.0-alpha.83",
      date: "2026-09-06",
      compareUrl: "",
      sections: [
        { type: "changed", heading: "Miscellaneous", items: ["a"] },
        { type: "changed", heading: "Code Refactoring", items: ["b", "c"] },
      ],
    });
    expect(mix).toEqual([
      { type: "changed", heading: "Miscellaneous", count: 1 },
      { type: "changed", heading: "Code Refactoring", count: 2 },
    ]);
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
