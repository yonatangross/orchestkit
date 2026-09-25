import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HomeContainer } from "../app/(home)/home-container";
import { ChangelogLegend } from "../components/changelog-legend";
import { HOW_TO_READ } from "../lib/changelog-format";

describe("home layout container", () => {
	it("is not a second <main>: pages under (home) and the 404 render their own", () => {
		const { container } = render(
			<HomeContainer className="extra">
				<main>page</main>
			</HomeContainer>,
		);
		expect(container.querySelectorAll("main")).toHaveLength(1);
		const shell = container.querySelector("#nd-home-layout");
		expect(shell?.tagName).toBe("DIV");
		expect(shell?.className).toContain("extra");
	});
});

describe("changelog legend", () => {
	it("is a plain key, one row per section type, with no dash joiners", () => {
		const { container } = render(<ChangelogLegend />);
		const rows = container.querySelectorAll("li");
		expect(rows).toHaveLength(HOW_TO_READ.length);
		expect(container.textContent ?? "").not.toMatch(/[\u2013\u2014]|--/);
	});
});
