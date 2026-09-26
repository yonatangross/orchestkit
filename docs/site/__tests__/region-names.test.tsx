import { afterEach, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { precedingHeading, uniqueRegionName } from "@/lib/region-name";
import { ScrollTable } from "@/components/scroll-table";
import { TocPopoverRole } from "@/components/toc-popover-role";

afterEach(() => {
	document.body.replaceChildren();
});

function mount(html: string): HTMLElement {
	const host = document.createElement("div");
	host.innerHTML = html; // test fixture markup, no user input
	document.body.appendChild(host);
	return host;
}

describe("precedingHeading", () => {
	it("finds the nearest heading before the element, climbing out of wrappers", () => {
		const host = mount('<h2>Blocked patterns</h2><p>intro</p><div><div id="t"></div></div>');
		expect(precedingHeading(host.querySelector("#t") as Element)).toBe("Blocked patterns");
	});

	it("takes the last heading inside an earlier sibling section", () => {
		const host = mount('<section><h2>A</h2><h3>B</h3></section><div id="t"></div>');
		expect(precedingHeading(host.querySelector("#t") as Element)).toBe("B");
	});

	it("returns an empty string when no heading comes before", () => {
		const host = mount('<div id="t"></div><h2>After</h2>');
		expect(precedingHeading(host.querySelector("#t") as Element)).toBe("");
	});
});

describe("uniqueRegionName", () => {
	it("adds an ordinal only when another region already has the name", () => {
		const host = mount(
			'<div role="region" aria-label="Table: Hooks"></div><div role="region" aria-label="Table: Hooks (2)"></div><div id="t" role="region"></div>',
		);
		const el = host.querySelector("#t") as Element;
		expect(uniqueRegionName(el, "Table: Hooks")).toBe("Table: Hooks (3)");
		expect(uniqueRegionName(el, "Table: Other")).toBe("Table: Other");
	});
});

describe("ScrollTable", () => {
	it("names each table region after its section, unique on the page", () => {
		const heading = document.createElement("h2");
		heading.textContent = "Literal patterns";
		document.body.appendChild(heading);
		const { container } = render(
			<>
				<ScrollTable>
					<tbody>
						<tr>
							<td>a</td>
						</tr>
					</tbody>
				</ScrollTable>
				<ScrollTable>
					<tbody>
						<tr>
							<td>b</td>
						</tr>
					</tbody>
				</ScrollTable>
			</>,
		);
		const names = [...container.querySelectorAll("[role=region]")].map((r) => r.getAttribute("aria-label"));
		expect(names).toEqual(["Table: Literal patterns", "Table: Literal patterns (2)"]);
	});
});

describe("TocPopoverRole", () => {
	it("drops the implicit banner role from the mobile TOC header", () => {
		const host = mount('<div data-toc-popover=""><header>toc</header></div>');
		render(<TocPopoverRole />);
		expect(host.querySelector("header")?.getAttribute("role")).toBe("none");
	});
});
