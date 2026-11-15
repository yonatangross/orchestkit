import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LibraryCatalog } from "@/components/library-catalog";
import {
  LIBRARY_COUNTS,
  LIBRARY_ITEMS,
  LIBRARY_STATIONS,
} from "@/lib/generated/library-data";
import { libraryItemHref } from "@/lib/library-view";

function listHrefs(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(
    doc.querySelectorAll<HTMLAnchorElement>("#library-list li a[href]"),
  ).map((a) => a.getAttribute("href") ?? "");
}

describe("LibraryCatalog (server component)", () => {
  const html = renderToStaticMarkup(<LibraryCatalog />);

  it("renders every item as one plain link in one flat list", () => {
    const hrefs = listHrefs(html);
    expect(hrefs).toHaveLength(LIBRARY_COUNTS.items);
    expect(new Set(hrefs).size).toBe(LIBRARY_COUNTS.items);
    expect(hrefs).toEqual(LIBRARY_ITEMS.map(libraryItemHref));
  });

  it("links skills, agents and hooks to the pages that exist", () => {
    const hrefs = listHrefs(html);
    expect(hrefs.filter((h) => h.startsWith("/docs/reference/skills/"))).toHaveLength(
      LIBRARY_COUNTS.skills,
    );
    expect(hrefs.filter((h) => h.startsWith("/docs/reference/agents/"))).toHaveLength(
      LIBRARY_COUNTS.agents,
    );
    const hooks = hrefs.filter((h) => h.startsWith("/docs/reference/hooks/"));
    expect(hooks).toHaveLength(LIBRARY_COUNTS.hooks);
    expect(hooks.every((h) => /#hook-[a-z0-9-]+$/.test(h))).toBe(true);
  });

  it("has no group headers inside the list", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelectorAll("#library-list h3, #library-list h4")).toHaveLength(0);
  });

  it("renders the seven stations as hash links for no-JS visitors", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const station of LIBRARY_STATIONS) {
      const chips = doc.querySelectorAll(`a[href="#station-${station.key}"]`);
      // one in the rail, one in the chip row
      expect(chips).toHaveLength(2);
      expect(doc.getElementById(`station-${station.key}`)).toBeTruthy();
    }
  });

  it("scopes the no-JS :has() rules to the library section, never body", () => {
    const style = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("#library style")?.textContent;
    expect(style).toBeTruthy();
    const rules = (style ?? "").split("\n").filter(Boolean);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule.startsWith("#library:not(.lib-js)")).toBe(true);
    expect(style).not.toMatch(/(^|\s)body:has|:root:has|html:has/);
  });

  it("holds one closed drawer dialog that is named by its title", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const drawers = doc.querySelectorAll("dialog[data-lib-drawer]");
    expect(drawers).toHaveLength(1);
    expect(drawers[0].hasAttribute("open")).toBe(false);
    expect(drawers[0].getAttribute("aria-labelledby")).toBe("lib-drawer-title");
    expect(doc.getElementById("lib-drawer-title")).toBeTruthy();
  });

  it("keeps the search hidden until the client layer runs", () => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("search[hidden] input[type=search]")).toBeTruthy();
  });
});
