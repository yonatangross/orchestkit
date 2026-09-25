import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { CommandText } from "@/components/install-snippet";

describe("CommandText", () => {
	const line = "codex plugin marketplace add yonatangross/orchestkit --ref main --sparse plugins/ork-codex";

	it("keeps the command text exact, spaces included", () => {
		const { container } = render(<CommandText line={line} />);
		expect(container.textContent).toBe(line);
	});

	it("makes every token unbreakable so lines break only at spaces", () => {
		const { container } = render(<CommandText line={line} />);
		const tokens = [...container.querySelectorAll(".whitespace-nowrap")].map((t) => t.textContent);
		expect(tokens).toEqual(line.split(" "));
		// Hyphenated tokens stay whole: the browser would otherwise break after "-".
		expect(tokens).toContain("--sparse");
		expect(tokens).toContain("plugins/ork-codex");
	});
});
