// A skill reference page is a folder (index plus references and rules pages)
// only while it is over the generator's byte budget. review-pr crossed back
// over it: /docs/reference/skills/review-pr/references and /rules are real
// pages again. The site redirects the sub-URLs of every skill the build wrote
// as ONE page to that page, and must leave the real pages of a folder alone.

import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile, match } from "next/dist/compiled/path-to-regexp";
import { siteRedirects } from "@/lib/site-redirects.mjs";
import { singlePageSkillSlugs } from "@/lib/skill-page-slugs.mjs";

type Redirect = {
	source: string;
	destination: string;
	has?: unknown[];
	permanent?: boolean;
};

const SKILLS = "/docs/reference/skills";
const CONTENT = join(process.cwd(), "content/docs/reference/skills");

// The canonical-host rules only (no `has` host condition).
// The same call next.config.mjs makes.
const CANONICAL_RULES = (siteRedirects(singlePageSkillSlugs()) as Redirect[]).filter((r) => !r.has);

function redirectFor(path: string): { to: string; permanent: boolean | undefined } | null {
	for (const rule of CANONICAL_RULES) {
		const m = match(rule.source, { strict: true, decode: decodeURIComponent })(path);
		if (m) {
			return {
				to: compile(rule.destination, { validate: false })(m.params),
				permanent: rule.permanent,
			};
		}
	}
	return null;
}

describe("review-pr is a folder again: its sub-URLs are real pages", () => {
	it.each(["references", "rules"])(`${SKILLS}/review-pr/%s does not redirect`, (sub) => {
		expect(redirectFor(`${SKILLS}/review-pr/${sub}`)).toBeNull();
	});

	it("review-pr is a folder on disk, so the sub-pages are real", () => {
		expect(existsSync(join(CONTENT, "review-pr.mdx"))).toBe(false);
		expect(existsSync(join(CONTENT, "review-pr"))).toBe(true);
	});

	it("the page itself does not redirect", () => {
		expect(redirectFor(`${SKILLS}/review-pr`)).toBeNull();
	});
});

describe("the rule follows what the build wrote", () => {
	it("every single-page skill redirects its sub-URLs and the destination is its own page", () => {
		const slugs = singlePageSkillSlugs();
		expect(slugs).not.toContain("review-pr");
		for (const slug of slugs) {
			expect(redirectFor(`${SKILLS}/${slug}/rules`)?.to).toBe(`${SKILLS}/${slug}`);
			expect(existsSync(join(CONTENT, `${slug}.mdx`))).toBe(true);
		}
	});

	it("a skill that is still a folder keeps its real sub-pages", () => {
		const folders = ["configure", "doctor", "implement", "verify", "brainstorm"];
		for (const slug of folders) {
			expect(singlePageSkillSlugs()).not.toContain(slug);
			expect(redirectFor(`${SKILLS}/${slug}/rules`), slug).toBeNull();
			expect(redirectFor(`${SKILLS}/${slug}/references`), slug).toBeNull();
		}
	});

	it("reads slugs from a content folder: index and non-mdx files are skipped", () => {
		const dir = mkdtempSync(join(tmpdir(), "skill-pages-"));
		writeFileSync(join(dir, "index.mdx"), "");
		writeFileSync(join(dir, "meta.json"), "{}");
		writeFileSync(join(dir, "alpha.mdx"), "");
		mkdirSync(join(dir, "beta"));
		writeFileSync(join(dir, "beta", "index.mdx"), "");
		expect(singlePageSkillSlugs(dir)).toEqual(["alpha"]);
		expect(singlePageSkillSlugs(join(dir, "missing"))).toEqual([]);
	});
});
