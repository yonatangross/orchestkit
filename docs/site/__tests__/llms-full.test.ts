import { expect, it, vi } from "vitest";
import { GET as getIndex } from "@/app/docs/llms.txt/route";
import { GET as getDump } from "@/app/llms-full.txt/route";
import { GET as getNavigation } from "@/app/llms.txt/route";
import { SITE } from "@/lib/constants";

vi.mock("@/lib/docs-content", () => ({
	SECTION_ORDER: ["guides"],
	orderedPages: () => Array.from({ length: 100 }, (_, i) => ({
		slugs: ["guides", `page-${i}`],
		url: `/docs/guides/page-${i}`,
		data: { title: `Guide ${i}`, description: "Description. ".repeat(70) },
	})),
	readDocBody: async ([, slug]: string[]) =>
		slug === "page-0" ? "Narrative body.\n".repeat(10_800) : "Secondary body.\n".repeat(15_000),
}));

function guideLinks(text: string): Set<string> {
	return new Set(Array.from(text.matchAll(/\]\((\/docs\/guides\/[^)]+)\)/g), ([, url]) => url));
}

it("retains every indexed guide URL when the full page bodies exceed the budget", async () => {
	const index = await getIndex().text();
	const dump = await (await getDump()).text();
	const indexLinks = guideLinks(index);
	expect(indexLinks.size).toBe(100);
	expect(guideLinks(dump)).toEqual(indexLinks);
	expect(dump.length).toBeLessThanOrEqual(190_000);
	expect(dump).toContain("Narrative body.");
	expect(dump).not.toContain("Secondary body.");
	expect(dump).toContain("Link-only pages: 99. Omitted indexed pages: 0.");
});

it("advertises the budget and puts the full page index before the dump contents", async () => {
	const navigation = await getNavigation().text();
	const dump = await (await getDump()).text();
	expect(navigation).toContain("[Budgeted documentation dump](/llms-full.txt)");
	expect(dump.split("## Quickstart")[0]).toContain(`[Full page index](${SITE.domain}/docs/llms.txt)`);
});
