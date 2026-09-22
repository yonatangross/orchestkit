import { describe, expect, it } from "vitest";
import {
	docsLandingMarkdown,
	isDocsLandingSlug,
} from "@/lib/docs-landing-markdown";

describe("docs landing markdown twins", () => {
	it("recognizes only mcp and sdk", () => {
		expect(isDocsLandingSlug("mcp")).toBe(true);
		expect(isDocsLandingSlug("sdk")).toBe(true);
		expect(isDocsLandingSlug("mcp-servers")).toBe(false);
	});

	it("keeps OrchestKit in the H1 and frontmatter title", () => {
		for (const slug of ["mcp", "sdk"] as const) {
			const md = docsLandingMarkdown(slug);
			const h1 = md.split("\n").find((l) => l.startsWith("# ")) as string;
			const title = md.split("\n").find((l) => l.startsWith("title: ")) as string;
			expect(h1).toContain("OrchestKit");
			expect(title).toContain("OrchestKit");
			expect(md).toContain(
				`canonical: "https://orchestkit.yonyon.ai/docs/${slug}"`,
			);
		}
	});
});
