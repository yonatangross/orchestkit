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

// #4144: the studio entity is canonically declared by the apex brand site
// (yonyon.ai). The docs subdomain must restate that entity, not mint a second
// Organization whose official website lives only on orchestkit.yonyon.ai.
describe("Yonyon studio Organization node", () => {
	const yonyonOrg = (): Record<string, unknown> | undefined =>
		homepageGraph().find(
			(n) => n["@type"] === "Organization" && n.name === "Yonyon",
		);

	it("reuses the apex entity @id instead of declaring a second Organization", () => {
		const org = yonyonOrg();
		expect(org).toBeTruthy();
		expect(org?.["@id"]).toBe("https://yonyon.ai/#organization");
	});

	it("points the official website at the apex studio, never only at the docs subdomain", () => {
		const org = yonyonOrg();
		expect(org?.url).toBe("https://yonyon.ai");
		const sameAs = org?.sameAs as string[];
		expect(sameAs).toContain("https://yonyon.ai");
		expect(sameAs).toContain("https://yonyon.ai/yonyon");
	});

	it("keeps the docs-subdomain /yonyon page as the page url only", () => {
		const org = yonyonOrg();
		expect(org?.mainEntityOfPage).toBe("https://orchestkit.yonyon.ai/yonyon");
		const sameAs = org?.sameAs as string[];
		expect(sameAs).not.toContain("https://orchestkit.yonyon.ai/yonyon");
	});
});
