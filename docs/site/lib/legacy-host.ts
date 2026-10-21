import { SITE } from "@/lib/constants";
import {
	LEGACY_HOST,
	LEGACY_KEEP_EXACT,
	LEGACY_KEEP_PREFIXES,
} from "@/lib/site-redirects.mjs";

// The pre-GA host (orchestkit.yonyon.ai). Its one 301 for pages is a config
// redirect (lib/site-redirects.mjs), placed first so it runs before any path
// redirect. This module is the middleware fallback for the same rule, reading
// the same host and keep list, so the two cannot disagree.
//
// The agent and MCP surface keeps answering 200 on the old host: installed MCP
// clients POST to /api/mcp, and many HTTP clients do not follow a 301 on POST
// (or replay it as a GET).
const KEEP_EXACT = new Set<string>(LEGACY_KEEP_EXACT);
const KEEP_PREFIXES: readonly string[] = LEGACY_KEEP_PREFIXES;

export function isLegacyHost(host: string | null): boolean {
	if (!host) return false;
	return host.split(":")[0].toLowerCase() === LEGACY_HOST;
}

export function keepsServingOnLegacyHost(pathname: string): boolean {
	if (KEEP_EXACT.has(pathname)) return true;
	return KEEP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// The absolute URL to redirect to, or null when the request must be served
// as is. `search` keeps its leading "?" (URL.search shape).
export function legacyRedirectTarget(
	host: string | null,
	pathname: string,
	search: string,
): string | null {
	if (!isLegacyHost(host)) return null;
	if (keepsServingOnLegacyHost(pathname)) return null;
	return `${SITE.domain}${pathname}${search}`;
}
