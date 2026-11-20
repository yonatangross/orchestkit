// The top nav: the logo goes home, Docs / Cookbook / Reference open submenus,
// and every submenu item points at a docs page that exists.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseOptions } from "@/app/layout.config";
import { BRAND } from "@/lib/constants";

type Item = { type?: string; text?: unknown; url?: string; items?: Item[] };
const links = (baseOptions.links ?? []) as Item[];
const byText = (t: string) => links.find((l) => l.text === t);

function docsPageExists(url: string): boolean {
	const rel = url.replace(/^\/docs\/?/, "");
	const base = join(__dirname, "..", "content", "docs", rel);
	return existsSync(`${base}.mdx`) || existsSync(join(base, "index.mdx"));
}

describe("top nav", () => {
	it("logo links to the home page", () => {
		expect(baseOptions.nav?.url).toBe("/");
	});

	it("brand mark comes from the one BRAND slot", () => {
		expect(BRAND.mark).toMatch(/^\/brand\//);
	});

	it.each(["Docs", "Cookbook", "Reference"])("%s is a submenu with items", (name) => {
		const menu = byText(name);
		expect(menu?.type).toBe("menu");
		expect(menu?.items?.length ?? 0).toBeGreaterThan(1);
	});

	it("every submenu item points at an existing docs page", () => {
		const urls = links
			.filter((l) => l.type === "menu")
			.flatMap((l) => l.items ?? [])
			.map((i) => i.url ?? "");
		expect(urls.length).toBeGreaterThan(0);
		const missing = urls.filter((u) => u.startsWith("/docs") && !docsPageExists(u));
		expect(missing).toEqual([]);
	});

	it("About is reachable from the nav", () => {
		expect(byText("About")?.url).toBe("/about");
	});
});
