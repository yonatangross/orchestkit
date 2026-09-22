import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Homepage social meta must carry og:type and og:image on the page itself
// (not only via app/layout.tsx). #4347 scoped title/description here; orank
// still scored missing og:type/og:image when those keys were absent from the
// child openGraph object (shallow merge dropped the file-based image).

describe("homepage social meta", () => {
	const src = readFileSync(
		resolve(__dirname, "../app/(home)/page.tsx"),
		"utf8",
	);

	it("declares og:type website on the homepage openGraph object", () => {
		expect(src).toMatch(/openGraph:\s*\{[\s\S]*?type:\s*"website"/);
	});

	it("declares og:image via openGraph.images pointing at /opengraph-image", () => {
		expect(src).toMatch(/images:\s*\[[\s\S]*?url:\s*"\/opengraph-image"/);
		expect(src).toMatch(/twitter:\s*\{[\s\S]*?images:\s*\["\/opengraph-image"\]/);
	});

	it("does not put those image fields in the root layout", () => {
		const layout = readFileSync(
			resolve(__dirname, "../app/layout.tsx"),
			"utf8",
		);
		expect(layout).not.toMatch(/images:\s*\[/);
		expect(layout).not.toContain('url: "/opengraph-image"');
	});
});
