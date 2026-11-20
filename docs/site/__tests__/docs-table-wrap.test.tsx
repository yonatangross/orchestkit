import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollTable } from "@/components/scroll-table";

const css = readFileSync(resolve(process.cwd(), "app/global.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
	const at = css.indexOf(`${selector} {`);
	expect(at, `rule ${selector}`).toBeGreaterThan(-1);
	return css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
}

describe("wide docs tables", () => {
	it("lets inline code in a cell wrap instead of setting the column width", () => {
		// nowrap made one 90 character command a 705px column and the feature matrix
		// 1707px wide on a 390px phone (dogfood ISSUE-004).
		const code = rule(":where(table) :is(td, th) code");
		expect(code).not.toMatch(/white-space:\s*nowrap/);
		expect(code).toMatch(/overflow-wrap:\s*anywhere/);
		expect(rule(":where(table) td:has(code)")).toMatch(/min-width:\s*\d/);
	});

	it("pins the first column while the table scrolls sideways", () => {
		expect(rule(".scroll-fade :is(td, th):first-child")).toMatch(/position:\s*sticky/);
		expect(rule(".scroll-fade td:first-child")).toMatch(/background-color:/);
		// overflow hidden on the table would make the table the sticky container.
		expect(rule(".scroll-fade > table")).toMatch(/overflow:\s*clip/);
	});

	it("keeps the table a direct child of the named, focusable scroll region", () => {
		const { container } = render(
			<ScrollTable>
				<tbody>
					<tr>
						<td>Feature</td>
					</tr>
				</tbody>
			</ScrollTable>,
		);
		const region = container.querySelector(".scroll-fade") as HTMLElement;
		expect(region.getAttribute("role")).toBe("region");
		expect(region.tabIndex).toBe(0);
		expect(region.getAttribute("aria-label")).toBeTruthy();
		expect(region.firstElementChild?.tagName).toBe("TABLE");
	});
});
