import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIBRARY_ITEMS } from "@/lib/generated/library-data";
import { libraryItemHref } from "@/lib/library-view";

const HOOKS_DIR = join(process.cwd(), "content/docs/reference/hooks");

/**
 * Every hook the library links to must have its anchor id on its event page.
 * The generator (scripts/_build-docs-generate.py, hook_anchor_id) writes the
 * id into the table row; library-view.ts hookAnchorId() builds the same id.
 */
describe("library hook anchors", () => {
  const hooks = LIBRARY_ITEMS.filter((item) => item.kind === "hook");

  it("finds all 151 hooks", () => {
    expect(hooks).toHaveLength(151);
  });

  it("has the anchor of every hook href on its event page", () => {
    const missing: string[] = [];
    for (const item of hooks) {
      const [path, anchor] = libraryItemHref(item).split("#");
      const slug = path.split("/").pop() ?? "";
      const source = readFileSync(join(HOOKS_DIR, `${slug}.mdx`), "utf8");
      if (!source.includes(`<span id="${anchor}"></span>`)) {
        missing.push(`${item.id} -> ${slug}#${anchor}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
