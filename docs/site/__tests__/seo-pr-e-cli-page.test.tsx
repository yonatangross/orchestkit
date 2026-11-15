// orchestkit.dev SEO gaps row 11 (orank Discovery 5, oc20 table 15.11.2026).
// /cli answered 404 on 15.11 (VERIFIED) while the CLI exists: packages/cli,
// published on npm as `orchestkit` 0.1.0 (registry read 15.11). The page
// states only what that package does, with an "OrchestKit CLI" title and H1,
// a self canonical, a sitemap row, and a link from the home server HTML.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { STATIC_PAGES } from "@/lib/static-pages";

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

describe("row 11: /cli page", () => {
	it("has an OrchestKit CLI title and a self canonical", async () => {
		const { metadata } = await import("@/app/(home)/cli/page");
		expect(String(metadata.title)).toMatch(/^OrchestKit CLI/);
		expect(metadata.alternates?.canonical).toBe("https://orchestkit.dev/cli");
	});

	it("renders one H1 and lists only the commands the CLI source handles", async () => {
		const { default: CliPage } = await import("@/app/(home)/cli/page");
		const { container } = render(<CliPage />);
		const h1 = container.querySelectorAll("h1");
		expect(h1).toHaveLength(1);
		expect(h1[0].textContent).toMatch(/^OrchestKit CLI/);
		const cliSrc = read("..", "..", "packages", "cli", "src", "cli-core.ts");
		const shown = [...(container.textContent ?? "").matchAll(/orchestkit (install|search|ask|read|mcp|doctor)\b/g)].map((m) => m[1]);
		expect(new Set(shown).size).toBe(6);
		for (const c of new Set(shown)) expect(cliSrc).toContain(`case "${c}"`);
		expect(container.textContent).toContain("npm i -g orchestkit");
	});

	it("is in the sitemap list and linked from the home page", () => {
		expect(STATIC_PAGES).toContain("/cli");
		expect(read("app", "(home)", "page.tsx")).toMatch(/href="\/cli"/);
	});
});
