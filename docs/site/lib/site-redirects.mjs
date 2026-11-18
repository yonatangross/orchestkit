// The site's config redirects, in the order Next.js evaluates them: the
// first rule whose source (and `has` host condition) matches wins, and config
// redirects run BEFORE middleware. next.config.mjs serves this list;
// __tests__/legacy-host-redirect-order.test.ts replays it.
//
// Plain .mjs so next.config.mjs can import it without a TypeScript step.

import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEVELOPER_ALIASES } from "./developer-aliases.mjs";

export const CANONICAL_ORIGIN = "https://orchestkit.dev";

// The pre-GA host. It stays on the same Vercel project and answers ONE 301 to
// the same path on CANONICAL_ORIGIN, except for the agent and MCP surface
// below, which keeps serving: installed MCP clients POST to /api/mcp, and many
// clients do not follow a 301 on POST (or replay it as a GET).
export const LEGACY_HOST = "orchestkit.yonyon.ai";
export const LEGACY_KEEP_EXACT = ["/mcp", "/mcp.json", "/ask", "/auth.md"];
export const LEGACY_KEEP_PREFIXES = ["/api/", "/.well-known/", "/agent/"];

// The production Vercel alias. Preview deployments (orchestkit-<hash>.vercel.app)
// do not match this exact host, so they stay reachable.
export const VERCEL_ALIAS_HOST = "orchestkit.vercel.app";

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hostIs = (host) => [{ type: "host", value: escapeRegex(host) }];

// Path pattern for every legacy-host path EXCEPT the kept ones (paths without
// the leading slash, exact paths anchored with $).
const LEGACY_KEPT = [
	...LEGACY_KEEP_PREFIXES.map((p) => escapeRegex(p.slice(1))),
	...LEGACY_KEEP_EXACT.map((p) => `${escapeRegex(p.slice(1))}$`),
].join("|");

// Host redirects. They come FIRST: a path redirect earlier in the list (for
// example /docs) would otherwise answer the old host with its own 307 and the
// host 301 would become a second hop.
function hostRedirects() {
	return [
		{
			source: "/",
			has: hostIs(LEGACY_HOST),
			destination: `${CANONICAL_ORIGIN}/`,
			statusCode: 301,
		},
		{
			source: `/:path((?!${LEGACY_KEPT}).+)`,
			has: hostIs(LEGACY_HOST),
			destination: `${CANONICAL_ORIGIN}/:path`,
			statusCode: 301,
		},
		{
			// (.*) and not :path*: Next matches sources strictly and trailing-slash
			// redirects are off, so :path* misses "/lab/" and that path would chain.
			source: "/:path(.*)",
			has: hostIs(VERCEL_ALIAS_HOST),
			destination: `${CANONICAL_ORIGIN}/:path`,
			statusCode: 301,
		},
	];
}

// Old-host copies of every path redirect, pointing straight at the FINAL
// URL on the canonical host. Without them the host 301 lands on a path that
// redirects again (old /docs -> 301 orchestkit.dev/docs -> 307 overview), a
// second hop. Kept paths are skipped on the legacy host: they never redirect.
function hostAliasRedirects(host) {
	return pathRedirects()
		.filter((rule) => host !== LEGACY_HOST || !isKeptOnLegacyHost(rule.source))
		.map((rule) => ({
			source: rule.source,
			has: hostIs(host),
			destination: `${CANONICAL_ORIGIN}${rule.destination}`,
			statusCode: 301,
		}));
}

function isKeptOnLegacyHost(path) {
	return (
		LEGACY_KEEP_EXACT.includes(path) ||
		LEGACY_KEEP_PREFIXES.some((prefix) => path.startsWith(prefix))
	);
}

// Order is the contract (first match wins): old-host copies of the path
// redirects, then the old-host catch-alls, then the path redirects that
// serve the canonical host.
export function siteRedirects() {
	return [
		...hostAliasRedirects(LEGACY_HOST),
		...hostAliasRedirects(VERCEL_ALIAS_HOST),
		...hostRedirects(),
		...pathRedirects(),
	];
}

// Reference pages of skills that merged into another skill (stage 1 of the
// catalog trim). The old URL answers a temporary redirect to the merged page.
const RETIRED_SKILL_PAGES = [
	["remember", "memory"],
	["dream", "memory"],
	["ci-sentinel", "ci-debug"],
];

// Slugs of the skill reference pages the build wrote as ONE file. The docs
// generator writes a skill as a folder (index plus references, rules, ...
// pages) only while the page is over its byte budget, so a skill that shrinks
// under it drops those sub-URLs and the old links 404. Read from the content
// folder the build just wrote, so the next skill that shrinks needs no edit
// here, and a skill that grows back into a folder stops being redirected (a
// config redirect runs before the file router and would hide its real pages).
const SKILL_PAGES_DIR = fileURLToPath(
	new URL("../content/docs/reference/skills/", import.meta.url),
);

export function singlePageSkillSlugs(dir = SKILL_PAGES_DIR) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(".mdx") && name !== "index.mdx")
		.map((name) => name.slice(0, -".mdx".length))
		.filter((slug) => /^[a-z0-9][a-z0-9-]*$/.test(slug))
		.sort();
}

function singlePageSkillRedirects() {
	const slugs = singlePageSkillSlugs();
	if (slugs.length === 0) return [];
	return [
		{
			// One rule for all of them: Vercel caps a project at 1024 redirects and
			// this list is copied for two old hosts. Permanent, unlike the rules
			// above: the folder is gone for good, not merged into another skill.
			source: `/docs/reference/skills/:slug(${slugs.join("|")})/:path+`,
			destination: "/docs/reference/skills/:slug",
			permanent: true,
		},
	];
}

// The site's own path redirects (canonical host).
function pathRedirects() {
	return [
		{
			source: "/docs",
			destination: "/docs/foundations/overview",
			permanent: false,
		},
		// The Lab gallery lives at /docs/showcase/lab; /lab/ itself only serves
		// the raw public/lab/<slug>.html pages, so the bare path was a 404 for
		// anyone trimming a shared playground URL. Temporary on purpose: a cached
		// 308 would outlive a real /lab index if one is ever added.
		{
			source: "/lab",
			destination: "/docs/showcase/lab",
			permanent: false,
		},
		{
			// skipTrailingSlashRedirect is on, so the slash form needs its own rule.
			source: "/lab/",
			destination: "/docs/showcase/lab",
			permanent: false,
		},
		...RETIRED_SKILL_PAGES.map(([from, to]) => ({
			source: `/docs/reference/skills/${from}`,
			destination: `/docs/reference/skills/${to}`,
			permanent: false,
		})),
		...singlePageSkillRedirects(),
		// Predictable aliases for the developer resources (orank "Developer
		// resource discoverability": use predictable URLs). Each lands on the
		// existing product-titled page; no page moves. Temporary for the same
		// reason as /lab: a cached 308 would outlive a real page at that path.
		// The list lives in lib/developer-aliases.mjs so a test can check every
		// destination is a real page and no source shadows one.
		...DEVELOPER_ALIASES.map(([source, destination]) => ({
			source,
			destination,
			permanent: false,
		})),
		{
			// A bare URL wrapped in Markdown bold (**https://.../lab/x.html**, as in
			// the #3746 PR body) keeps its asterisks when a non-GitHub autolinker
			// turns it into a link, and PostHog recorded /lab/<slug>.html** hits.
			source: "/lab/:slug([a-z0-9][a-z0-9-]*).html:stars(\\*+)",
			destination: "/lab/:slug.html",
			permanent: true,
		},
	];
}
