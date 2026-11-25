import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/constants";
import { docsHtmlCanonical } from "@/lib/docs-canonical";

// The docs generator copies content/docs/hooks/spotlights into the hook
// reference, so each spotlight answers at two URLs with one title. One of the
// two must be canonical (live 2026-11-25: both were self-canonical).
const docs = resolve(__dirname, "../content/docs");
const slugs = readdirSync(resolve(docs, "hooks/spotlights"))
	.filter((name) => name.endsWith(".mdx"))
	.map((name) => name.replace(/\.mdx$/, ""));

describe("hook spotlight canonical", () => {
	it("finds the copied pages it is about", () => {
		expect(slugs.length).toBeGreaterThanOrEqual(5);
		for (const slug of slugs) {
			const copy = resolve(docs, `reference/hooks/spotlights/${slug}.mdx`);
			expect(existsSync(copy), slug).toBe(true);
			expect(readFileSync(copy, "utf8")).toBe(
				readFileSync(resolve(docs, `hooks/spotlights/${slug}.mdx`), "utf8"),
			);
		}
	});

	it("points the reference copy at the source page", () => {
		for (const slug of slugs) {
			const source = `${SITE.domain}/docs/hooks/spotlights/${slug}`;
			expect(docsHtmlCanonical(["reference", "hooks", "spotlights", slug])).toBe(source);
			expect(docsHtmlCanonical(["hooks", "spotlights", slug])).toBe(source);
		}
	});

	it("leaves the other hook reference pages self canonical", () => {
		expect(docsHtmlCanonical(["reference", "hooks", "session-end"])).toBe(
			`${SITE.domain}/docs/reference/hooks/session-end`,
		);
		expect(docsHtmlCanonical(["reference", "hooks"])).toBe(`${SITE.domain}/docs/reference/hooks`);
	});
});
