// orchestkit.dev SEO gaps rows 3 and 15 (oc20 table, 15.11.2026).
// Row 3: the home FAQ lived in JSON-LD only (live probe: 1 of 6 questions and
// 0 of 6 answers in the server text). Every question and answer must be in the
// server HTML, open, with the same text as the FAQPage JSON-LD.
// Row 15: AI crawlers that get Markdown at / (OAI-SearchBot, PerplexityBot)
// saw no JSON-LD, so the root Markdown must carry the key facts and the FAQ.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HOME_FAQS } from "@/components/structured-data";
import { COUNTS, SITE } from "@/lib/constants";

const src = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

describe("row 3: visible home FAQ", () => {
	it("JSON-LD answers are plain text, so the visible text can match them", () => {
		for (const f of HOME_FAQS) expect(f.answer, f.question).not.toMatch(/`/);
	});

	it("renders every question as a heading and every answer in open text", async () => {
		const { HomeFaq } = await import("@/components/home-faq");
		const { container } = render(<HomeFaq />);
		const text = container.textContent ?? "";
		const heads = [...container.querySelectorAll("h3")].map((h) => h.textContent?.trim());
		for (const f of HOME_FAQS) {
			expect(heads).toContain(f.question);
			expect(text).toContain(f.answer);
		}
		expect(container.querySelector("details, [hidden], [aria-hidden='true']")).toBeNull();
	});

	it("the home page renders the FAQ", () => {
		expect(src("app", "(home)", "page.tsx")).toMatch(/<HomeFaq\s*\/>/);
	});
});

describe("row 15: key facts in the root Markdown", () => {
	it("lists the counts, licence, price, install and the FAQ", async () => {
		const { homeFactsMarkdown } = await import("@/lib/home-facts");
		const md = homeFactsMarkdown();
		expect(md).toContain("## Key facts");
		expect(md).toContain(`${COUNTS.skills} skills`);
		expect(md).toContain(`${COUNTS.agents} agents`);
		expect(md).toContain(`${COUNTS.hooks} hooks`);
		expect(md).toContain("MIT");
		expect(md).toContain(SITE.installCommand);
		expect(md).toContain(SITE.github);
		for (const f of HOME_FAQS) {
			expect(md).toContain(`### ${f.question}`);
			expect(md).toContain(f.answer);
		}
	});

	it("the Markdown route puts the facts on the home body", () => {
		expect(src("app", "api", "md", "[[...slug]]", "route.ts")).toMatch(/homeFactsMarkdown\(\)/);
	});
});
