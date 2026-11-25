import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SITE } from "@/lib/constants";
import { siteRedirects } from "@/lib/site-redirects.mjs";
import { REDIRECT_PAGES, STATIC_PAGES } from "@/lib/static-pages";

// A sitemap lists the URLs that answer, never ones that answer a redirect
// (live 2026-11-25: /mcp-server, /sdk and the retired ci-sentinel reference
// page were listed and each answered 307).
vi.mock("@/lib/source", async () => {
	const { readdirSync } = await import("node:fs");
	const { join, relative, resolve } = await import("node:path");
	const root = resolve(__dirname, "../content/docs");
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith(".mdx")) files.push(relative(root, p));
		}
	};
	walk(root);
	const pages = files.map((path) => {
		const slugs = path.replace(/\.mdx$/, "").split("/");
		if (slugs[slugs.length - 1] === "index") slugs.pop();
		return { path, slugs, data: {} };
	});
	return { source: { getPages: () => pages } };
});

async function listedPaths(): Promise<string[]> {
	const mod = await import("@/app/sitemap");
	return mod.default().map(({ url }) => url.slice(SITE.domain.length) || "/");
}

const callsRedirect = (path: string) =>
	/\bredirect\(/.test(
		readFileSync(resolve(__dirname, `../app/(home)${path}/page.tsx`), "utf8"),
	);

describe("sitemap lists final URLs only", () => {
	it("lists no source of a config redirect on the canonical host", async () => {
		const sources = siteRedirects()
			.filter((rule) => !("has" in rule))
			.map((rule) => rule.source);
		// Control: the retired skill page is one of the rules being checked.
		expect(sources).toContain("/docs/reference/skills/ci-sentinel");
		const listed = new Set(await listedPaths());
		expect(sources.filter((source) => listed.has(source))).toEqual([]);
	});

	it("lists no page that only redirects", async () => {
		const redirecting = STATIC_PAGES.filter(callsRedirect);
		expect([...REDIRECT_PAGES].sort()).toEqual([...redirecting].sort());
		expect(redirecting.length).toBeGreaterThan(0);
		const listed = new Set(await listedPaths());
		expect(redirecting.filter((path) => listed.has(path))).toEqual([]);
	});

	it("still lists the pages those redirects point at", async () => {
		const listed = new Set(await listedPaths());
		for (const path of ["/docs/mcp", "/docs/sdk", "/docs/reference/skills/ci-debug", "/cli", "/developers"]) {
			expect(listed.has(path), path).toBe(true);
		}
	});
});
