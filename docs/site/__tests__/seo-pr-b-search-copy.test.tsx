// orchestkit.dev SEO gaps, rows 1, 8, 9 and 10 (oc20 table, 15.11.2026).
// Title 30 to 60 characters and cross-harness on the home page; deep docs
// titles that say what the page is; meta descriptions 140 to 160 characters
// with a number; every top-level Organization in the home JSON-LD carries a
// logo, and the OrchestKit Organization is declared once and referenced by @id.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HOME_TITLE, PAGE_SUMMARY } from "@/lib/constants";
import { HomepageStructuredData } from "@/components/structured-data";
import { docsSearchDescription, docsSearchTitle } from "@/lib/search-copy";
import { metadata as compareMeta } from "@/app/(home)/compare/page";
import { metadata as alternativesMeta } from "@/app/(home)/alternatives/page";

const DOCS = join(process.cwd(), "content", "docs");
const SUFFIX = " | OrchestKit";

function front(rel: string): { title: string; description: string } {
	const src = readFileSync(join(DOCS, rel), "utf8");
	const fm = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
	const get = (k: string) =>
		(fm.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
	return { title: get("title"), description: get("description") };
}

function expectTitle(t: string) {
	expect(t.length, t).toBeGreaterThanOrEqual(30);
	expect(t.length, t).toBeLessThanOrEqual(60);
}

function expectDescription(d: string) {
	expect(d.length, d).toBeGreaterThanOrEqual(140);
	expect(d.length, d).toBeLessThanOrEqual(160);
	expect(d, d).toMatch(/[0-9]/);
	expect(d).not.toMatch(/[–—]/);
}

describe("row 1: home title", () => {
	it("is 30 to 60 characters", () => expectTitle(HOME_TITLE));
	it("names more than one agent host", () => {
		expect(HOME_TITLE).toContain("Claude Code");
		expect(HOME_TITLE).toMatch(/Cursor|Codex/);
	});
	it("keeps the home description in range", () => expectDescription(PAGE_SUMMARY.site));
});

describe("row 9: deep docs titles say what the page is", () => {
	it("skill page", () => {
		const t = docsSearchTitle(["reference", "skills", "brainstorm"], "Brainstorm");
		expect(t).toBe(`Brainstorm skill for AI coding agents${SUFFIX}`);
		expectTitle(t);
	});
	it("agent page", () => {
		const t = docsSearchTitle(["reference", "agents", "debug-investigator"], "Debug Investigator");
		expectTitle(t);
		expect(t).toContain("agent");
	});
	it("a long skill name still fits", () => {
		expectTitle(docsSearchTitle(["reference", "skills", "x"], "Claude Design Orchestrator Workflow"));
	});
	it("a page with seoTitle keeps it", () => {
		expect(docsSearchTitle(["guides", "x"], "X", "Own title | OrchestKit")).toBe("Own title | OrchestKit");
	});
	it("alternatives page", () => {
		expectTitle(`${String(alternativesMeta.title)}${SUFFIX}`);
	});
	it("compare page", () => {
		expectTitle(`${String(compareMeta.title)}${SUFFIX}`);
	});
});

describe("row 8: meta descriptions 140 to 160 with a number", () => {
	it("brainstorm skill page (source description 251 chars)", () => {
		const { description } = front("reference/skills/brainstorm/index.mdx");
		const d = docsSearchDescription(["reference", "skills", "brainstorm"], description);
		expectDescription(d);
		expect(d).not.toMatch(/Not for/);
	});
	it("skills reference index", () => {
		expectDescription(front("reference/skills/index.mdx").description);
	});
	it("agents reference index", () => {
		expectDescription(front("reference/agents/index.mdx").description);
	});
	it("compare page", () => expectDescription(String(compareMeta.description)));
	it("alternatives page", () => expectDescription(String(alternativesMeta.description)));
	it("an in-range description is kept as written", () => {
		const own = "x".repeat(140) + " 12";
		expect(docsSearchDescription(["guides", "a"], own)).toBe(own);
	});
	it("a short agent description is filled to range", () => {
		expectDescription(docsSearchDescription(["reference", "agents", "a"], "Finds bugs."));
	});
});

describe("row 10: Organization JSON-LD", () => {
	const graph = (): Array<Record<string, unknown>> => {
		const { container } = render(<HomepageStructuredData starCount={1} />);
		const s = container.querySelector('script[type="application/ld+json"]');
		return JSON.parse(s?.textContent ?? "{}")["@graph"];
	};
	it("every top-level Organization has a logo and a url", () => {
		const orgs = graph().filter((n) => n["@type"] === "Organization");
		expect(orgs.length).toBeGreaterThan(0);
		for (const o of orgs) {
			expect(o.logo, String(o.name)).toBeTruthy();
			expect(o.url, String(o.name)).toBeTruthy();
		}
	});
	it("declares the OrchestKit Organization once; others point to it by @id", () => {
		const id = "https://orchestkit.dev/#organization";
		const full = graph().filter((n) => n["@id"] === id && n["@type"] === "Organization");
		expect(full).toHaveLength(1);
		const sameAs = full[0].sameAs as string[];
		expect(sameAs.some((s) => s.includes("github.com/yonatangross"))).toBe(true);
		expect(sameAs.some((s) => s.includes("wikidata.org"))).toBe(true);
		expect(sameAs.map((s) => s.replace(/\/$/, ""))).not.toContain("https://orchestkit.dev");
	});
	it("restates the Yonyon studio with the apex site's own logo", () => {
		const y = graph().find((n) => n["@id"] === "https://yonyon.ai/#organization");
		expect((y?.logo as Record<string, unknown>)?.url).toBe("https://yonyon.ai/logo.png");
	});
});
