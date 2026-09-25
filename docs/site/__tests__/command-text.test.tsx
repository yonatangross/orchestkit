import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CommandText } from "@/components/install-snippet";

const segmentsOf = (container: HTMLElement) =>
	[...container.querySelectorAll(".whitespace-nowrap")].map((s) => s.textContent);

describe("CommandText", () => {
	const codex = "codex plugin marketplace add yonatangross/orchestkit --ref main --sparse plugins/ork-codex";

	it("keeps the command text exact, spaces included", () => {
		const { container } = render(<CommandText line={codex} />);
		expect(container.textContent).toBe(codex);
	});

	it("keeps each token together and never offers a break at a hyphen", () => {
		const { container } = render(<CommandText line={codex} />);
		const tokens = [...container.querySelectorAll("[data-token]")].map((t) => t.textContent?.trim());
		expect(tokens).toEqual(codex.split(" "));
		const segments = segmentsOf(container);
		// Hyphenated words stay whole: the browser would otherwise break after "-".
		expect(segments).toContain("--sparse");
		expect(segments).toContain("ork-codex");
	});

	it("lets a long URL wrap after / and #, never inside a segment", () => {
		// Devin's git URL was one 406px unbreakable span, clipped at 390 (gate NEW-1).
		const devin = "devin plugin install https://github.com/yonatangross/orchestkit#plugins/ork";
		const { container } = render(<CommandText line={devin} />);
		expect(container.textContent).toBe(devin);
		expect(segmentsOf(container)).toEqual([
			"devin",
			"plugin",
			"install",
			"https:/",
			"/",
			"github.com/",
			"yonatangross/",
			"orchestkit#",
			"plugins/",
			"ork",
		]);
		expect(container.querySelectorAll("wbr")).toHaveLength(6);
	});
});
