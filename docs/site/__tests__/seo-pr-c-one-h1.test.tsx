// orchestkit.dev SEO gaps row 7 (oc20 table, 15.11.2026): skill and agent
// pages rendered two H1s, the page title and the "# " heading of the MDX body.
// The live probe counted h1 = 2 on /docs/reference/skills, /brainstorm and
// /docs/reference/agents. The body heading must render as an H2.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

const PAGE = join(process.cwd(), "app", "docs", "[[...slug]]", "page.tsx");

describe("row 7: one H1 per docs page", () => {
	it("the docs page maps the MDX h1 to ContentH1", () => {
		const src = readFileSync(PAGE, "utf8");
		expect(src).toMatch(/h1:\s*ContentH1/);
	});

	it("ContentH1 renders an h2 that keeps the anchor id and text", async () => {
		const { ContentH1 } = await import("@/components/content-h1");
		const { container } = render(<ContentH1 id="brainstorm">Brainstorm</ContentH1>);
		expect(container.querySelectorAll("h1")).toHaveLength(0);
		const h2 = container.querySelector("h2");
		expect(h2?.id).toBe("brainstorm");
		expect(h2?.textContent).toContain("Brainstorm");
	});

	it("generated skill pages still carry the body heading this guards", () => {
		const src = readFileSync(
			join(process.cwd(), "content", "docs", "reference", "skills", "brainstorm", "index.mdx"),
			"utf8",
		);
		expect(src).toMatch(/^# /m);
	});
});
