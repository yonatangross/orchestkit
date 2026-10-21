// Codex XREVIEW on #4819, twice:
// 1. next.config redirects run BEFORE middleware, so a path redirect such as
//    /docs fired first on the old host (307) and the host 301 came second.
// 2. Putting the host 301 first only reversed the chain: old /docs -> 301
//    orchestkit.dev/docs -> 307 overview. Still two hops.
// So this test FOLLOWS the chain the way a client does, and every request on
// the old host (or the Vercel alias) must reach its final page in exactly ONE
// hop, with the query kept.
//
// It replays Next's rule for config redirects: the list is evaluated in
// order, a rule applies when its `has` host condition and its source match,
// the first rule that applies wins, and the request query is appended to the
// destination. Matching and destination building use the path-to-regexp build
// that Next itself ships.

import { describe, expect, it } from "vitest";
import { compile, match } from "next/dist/compiled/path-to-regexp";
import { DEVELOPER_ALIASES } from "@/lib/developer-aliases.mjs";
import { siteRedirects } from "@/lib/site-redirects.mjs";

type HasHost = { type: "host"; value: string };
type Redirect = {
	source: string;
	destination: string;
	has?: HasHost[];
	statusCode?: number;
	permanent?: boolean;
};

const RULES = siteRedirects() as Redirect[];
const CANONICAL = "orchestkit.dev";

type Hop = { host: string; path: string; query: string };

function applies(rule: Redirect, req: Hop): Record<string, unknown> | null {
	const hostOk = (rule.has ?? []).every(
		(h) => h.type === "host" && new RegExp(`^${h.value}$`).test(req.host),
	);
	if (!hostOk) return null;
	const m = match(rule.source, { strict: true, decode: decodeURIComponent })(req.path);
	return m ? (m.params as Record<string, unknown>) : null;
}

function next(req: Hop): Hop | null {
	for (const rule of RULES) {
		const params = applies(rule, req);
		if (!params) continue;
		const abs = rule.destination.match(/^https:\/\/([^/]+)(\/.*)?$/);
		const host = abs ? abs[1] : req.host;
		const destPath = abs ? (abs[2] ?? "/") : rule.destination;
		const path = compile(destPath, { validate: false })(params) || "/";
		return { host, path, query: req.query };
	}
	return null;
}

function follow(start: Hop): Hop[] {
	const hops: Hop[] = [];
	let cur: Hop | null = start;
	while (cur && hops.length < 5) {
		const n = next(cur);
		if (!n) break;
		hops.push(n);
		cur = n;
	}
	return hops;
}

// Every path the site redirects on its own, as a concrete request path.
const PATH_REDIRECT_PATHS = [
	"/docs",
	"/lab",
	"/lab/",
	"/lab/x.html**",
	...DEVELOPER_ALIASES.map(([source]) => source),
];
const PAGES = ["/", "/about", "/docs/foundations/overview", "/llms.txt"];

describe("old hosts reach the final page in exactly one hop", () => {
	for (const host of ["orchestkit.yonyon.ai", "orchestkit.vercel.app"]) {
		it.each([...PATH_REDIRECT_PATHS, ...PAGES])(`${host}%s?x=1: one 301, final, query kept`, (path) => {
			const hops = follow({ host, path, query: "?x=1" });
			expect(hops.length, JSON.stringify(hops)).toBe(1);
			const [end] = hops;
			expect(end.host).toBe(CANONICAL);
			expect(end.query).toBe("?x=1");
			// The final URL must not redirect again.
			expect(next(end), JSON.stringify(end)).toBeNull();
			// And the one hop is a 301.
			const rule = RULES.find((r) => applies(r, { host, path, query: "?x=1" }));
			expect(rule?.statusCode).toBe(301);
		});
	}

	it.each([
		"/api/mcp",
		"/api/mcp/actions",
		"/api/search",
		"/mcp",
		"/mcp.json",
		"/ask",
		"/auth.md",
		"/agent/identity",
		"/.well-known/oauth-protected-resource",
	])("orchestkit.yonyon.ai%s is never redirected (MCP and agent clients)", (path) => {
		expect(follow({ host: "orchestkit.yonyon.ai", path, query: "" })).toEqual([]);
	});

	it("the canonical host keeps its own path redirects and no host redirect", () => {
		expect(next({ host: CANONICAL, path: "/docs", query: "" })?.path).toBe(
			"/docs/foundations/overview",
		);
		expect(next({ host: CANONICAL, path: "/about", query: "" })).toBeNull();
	});
});
