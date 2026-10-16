import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_TITLE, PAGE_SUMMARY } from "@/lib/constants";

// Search result copy. A description longer than 160 characters is cut in the
// result, and one shorter than 140 wastes the space. A page that sets
// `seoTitle` is a page we tuned for search, so it must keep these limits.
const DOCS = join(process.cwd(), "content", "docs");
// En dash and em dash, written as escapes so this file holds neither.
const DASH = /[\u2013\u2014]/;

function mdxFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) return mdxFiles(p);
		return name.endsWith(".mdx") ? [p] : [];
	});
}

function frontmatterValue(src: string, key: string): string | undefined {
	const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const raw = fm.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim();
	if (raw === undefined) return undefined;
	return raw.replace(/^"(.*)"$/, "$1");
}

describe("homepage search copy", () => {
	it("names Claude Code in the title", () => {
		expect(HOME_TITLE).toContain("Claude Code");
	});

	it("keeps the description between 140 and 160 characters", () => {
		expect(PAGE_SUMMARY.site.length).toBeGreaterThanOrEqual(140);
		expect(PAGE_SUMMARY.site.length).toBeLessThanOrEqual(160);
	});
});

describe("docs pages with seoTitle", () => {
	const tuned = mdxFiles(DOCS)
		.map((p) => ({ p, src: readFileSync(p, "utf8") }))
		.filter(({ src }) => frontmatterValue(src, "seoTitle") !== undefined);

	it("exist", () => {
		expect(tuned.length).toBeGreaterThanOrEqual(8);
	});

	for (const { p, src } of tuned) {
		const name = relative(DOCS, p);
		it(`${name} keeps search copy in limits`, () => {
			const seoTitle = frontmatterValue(src, "seoTitle") ?? "";
			const description = frontmatterValue(src, "description") ?? "";
			expect(seoTitle.length, "seoTitle length").toBeLessThanOrEqual(65);
			expect(seoTitle).toContain("OrchestKit");
			expect(description.length, "description length").toBeGreaterThanOrEqual(140);
			expect(description.length, "description length").toBeLessThanOrEqual(160);
			expect(DASH.test(seoTitle + description)).toBe(false);
		});
	}
});

describe("What's new in v10", () => {
	it("is in the docs navigation", () => {
		const meta = JSON.parse(readFileSync(join(DOCS, "meta.json"), "utf8"));
		expect(meta.pages).toContain("whats-new-v10");
	});
});
