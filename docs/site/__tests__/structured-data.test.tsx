// Guards the orank "schema breadth" recovery: the homepage JSON-LD @graph must
// include a BreadcrumbList node (the breadcrumbNode fn existed but was never
// wired into the homepage graph), alongside the existing entity nodes.

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { HomepageStructuredData } from "@/components/structured-data";

function homepageGraph(): Array<Record<string, unknown>> {
	const { container } = render(<HomepageStructuredData starCount={42} />);
	const script = container.querySelector(
		'script[type="application/ld+json"]',
	) as HTMLScriptElement | null;
	expect(script).toBeTruthy();
	const data = JSON.parse(script?.textContent ?? "{}");
	expect(data["@context"]).toBe("https://schema.org");
	return data["@graph"] as Array<Record<string, unknown>>;
}

describe("homepage JSON-LD graph", () => {
	it("includes a BreadcrumbList node with a valid root crumb", () => {
		const graph = homepageGraph();
		const breadcrumb = graph.find((n) => n["@type"] === "BreadcrumbList");
		expect(breadcrumb).toBeTruthy();

		const items = breadcrumb?.itemListElement as Array<Record<string, unknown>>;
		expect(Array.isArray(items)).toBe(true);
		expect(items.length).toBeGreaterThanOrEqual(1);

		const first = items[0];
		expect(first["@type"]).toBe("ListItem");
		expect(first.position).toBe(1);
		expect(first.name).toBe("Home");
		expect(typeof first.item).toBe("string");
		expect(first.item as string).toMatch(/^https?:\/\//);
	});

	it("still carries the core entity nodes (Organization + SoftwareApplication)", () => {
		const graph = homepageGraph();
		const types = graph.map((n) => n["@type"]);
		expect(types).toContain("Organization");
		expect(types).toContain("SoftwareApplication");
		expect(types).toContain("BreadcrumbList");
	});
});
