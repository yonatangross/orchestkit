import { describe, expect, it } from "vitest";
import {
	HOST_ALIAS_BONUS,
	hasWholeWord,
	hostAliasBonus,
	hostAliasUrl,
	passesShortQueryInfix,
} from "@/lib/host-aliases";
import { rerankByRelevance } from "@/lib/search-relevance";

describe("host aliases", () => {
	it("maps short host names to the honest docs URL", () => {
		expect(hostAliasUrl("pi")).toBe("/docs/getting-started/skills-sh");
		expect(hostAliasUrl("codex")).toBe("/docs/getting-started/codex");
		expect(hostAliasUrl("cursor")).toBe("/docs/getting-started/cursor");
		expect(hostAliasUrl("muse")).toBe("/docs/getting-started/muse");
		expect(hostAliasUrl("muse code")).toBe("/docs/getting-started/muse");
		expect(hostAliasUrl("musecode")).toBe("/docs/getting-started/muse");
		expect(hostAliasUrl("skills.sh")).toBe("/docs/getting-started/skills-sh");
	});

	it("maps muse to the Muse Code host page, not a fake plugin pack", () => {
		expect(hostAliasUrl("muse")).toBe("/docs/getting-started/muse");
		expect(hostAliasUrl("muse")).not.toBe("/docs/getting-started/hosts");
	});

	it("applies the alias floor only to the mapped URL", () => {
		expect(hostAliasBonus("pi", "/docs/getting-started/skills-sh")).toBe(
			HOST_ALIAS_BONUS,
		);
		expect(hostAliasBonus("pi", "/docs/reference/skills/pii-masking")).toBe(0);
	});
});

describe("short-query infix", () => {
	it("drops mid-word title hits for queries shorter than 4 chars", () => {
		expect(
			passesShortQueryInfix("pi", "Detect and mask PII in LLM pipelines", "/x"),
		).toBe(false);
		expect(passesShortQueryInfix("pi", "Pixel-perfect differences", "/x")).toBe(
			false,
		);
		expect(passesShortQueryInfix("pi", "Token pipeline", "/x")).toBe(false);
	});

	it("keeps whole-word Pi and host alias URLs", () => {
		expect(
			passesShortQueryInfix(
				"pi",
				"skills.sh (Pi, OpenCode, and other clients)",
				"/docs/getting-started/skills-sh",
			),
		).toBe(true);
		expect(hasWholeWord("pi", "skills.sh (Pi, OpenCode)")).toBe(true);
	});

	it("does not drop ranking fixtures whose title lacks the query", () => {
		expect(passesShortQueryInfix("q", "A", "/docs/guides/b")).toBe(true);
	});
});

describe("rerankByRelevance host floor", () => {
	it("pins the Pi host page above PII and pipeline titles", () => {
		const ranked = rerankByRelevance(
			[
				{
					url: "/docs/reference/skills/pii-masking",
					title: "pii-masking",
					matchCount: 12,
				},
				{
					url: "/docs/getting-started/skills-sh",
					title: "skills.sh (Pi, OpenCode, and other clients)",
					matchCount: 1,
				},
				{
					url: "/docs/guides/figma",
					title: "Pixel-perfect differences",
					matchCount: 8,
				},
			],
			"pi",
		).map((b) => b.url);

		expect(ranked[0]).toBe("/docs/getting-started/skills-sh");
		expect(ranked).not.toContain("/docs/reference/skills/pii-masking");
		expect(ranked).not.toContain("/docs/guides/figma");
	});
});
