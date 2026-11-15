// AEO fix list, first three orchestkit.dev rows (probe 15.11.2026, KB 01a1de35):
// answer engines lift the first lines of a page, so the pages that match the
// probe questions open with the answer, and every summary line says the same
// cross-harness facts and the same skill count.
//  1. /best-claude-code-plugins opens with a short answer (25 to 60 words)
//     before the disclosure and the lists.
//  2. /docs/hooks opens with what the hooks library is and where it runs.
//  3. The home description, the Yonyon FAQ and the banner say Claude Code,
//     Cursor and Codex, and give one skill total.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNER_TEXT, COUNTS, PAGE_SUMMARY } from "@/lib/constants";
import { BEST_PLUGINS_ANSWER, HOOKS_ANSWER } from "@/lib/aeo-answers";
import { YONYON_FAQS } from "@/lib/yonyon-faqs";

const src = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const words = (t: string) => t.trim().split(/\s+/).length;
const HOSTS = ["Claude Code", "Cursor", "Codex"];

function namesHosts(text: string, where: string) {
	for (const h of HOSTS) expect(text, `${where}: ${h}`).toContain(h);
}

describe("AEO 1: the best-plugins page answers first", () => {
	it("the answer is short, disclosed and honest about hooks", () => {
		const n = words(BEST_PLUGINS_ANSWER);
		expect(n).toBeGreaterThanOrEqual(25);
		expect(n).toBeLessThanOrEqual(60);
		expect(BEST_PLUGINS_ANSWER).toContain("claude-plugins-official");
		expect(BEST_PLUGINS_ANSWER).toContain("we maintain");
		namesHosts(BEST_PLUGINS_ANSWER, "best-plugins answer");
		expect(BEST_PLUGINS_ANSWER).toMatch(/hooks run (only )?(in|on) Claude Code/i);
		expect(BEST_PLUGINS_ANSWER).not.toMatch(/\bbest\b/i);
	});

	it("the page renders the answer before the disclosure and the first list", () => {
		const page = src("app", "(home)", "best-claude-code-plugins", "page.tsx");
		const at = page.indexOf("{BEST_PLUGINS_ANSWER}");
		expect(at).toBeGreaterThan(-1);
		expect(at).toBeLessThan(page.indexOf("<strong>Disclosure:</strong>"));
		expect(at).toBeLessThan(page.indexOf("<h2>"));
	});
});

describe("AEO 2: the hooks docs index answers first", () => {
	it("the first paragraph says what the hooks are and where they run", () => {
		const body = src("content", "docs", "hooks", "index.mdx").split("---")[2];
		const first = body
			.split("\n\n")
			.map((b) => b.trim())
			.find((b) => b && !b.startsWith("import"));
		expect(first).toBe(HOOKS_ANSWER);
		expect(words(HOOKS_ANSWER)).toBeLessThanOrEqual(60);
		expect(HOOKS_ANSWER).toMatch(/^OrchestKit's hooks are /);
		namesHosts(HOOKS_ANSWER, "hooks answer");
	});
});

describe("AEO 3: one cross-harness line and one skill count", () => {
	it("home description", () => {
		namesHosts(PAGE_SUMMARY.site, "PAGE_SUMMARY.site");
		expect(PAGE_SUMMARY.site).not.toContain("Claude Code plugin:");
		expect(PAGE_SUMMARY.site).toContain(`${COUNTS.skills} skills`);
		expect(PAGE_SUMMARY.site.length).toBeGreaterThanOrEqual(140);
		expect(PAGE_SUMMARY.site.length).toBeLessThanOrEqual(160);
	});

	it("Yonyon FAQ answers", () => {
		for (const f of YONYON_FAQS) {
			expect(f.answer, f.question).not.toContain("open-source plugin for Claude Code");
			expect(f.answer, f.question).not.toMatch(/hooks for Claude Code, MIT/);
		}
		namesHosts(YONYON_FAQS[0].answer, "Yonyon FAQ 1");
		namesHosts(YONYON_FAQS[1].answer, "Yonyon FAQ 2");
	});

	it("banner gives the same skill total as every other surface", () => {
		expect(BANNER_TEXT).toContain(`${COUNTS.skills} skills`);
	});
});
