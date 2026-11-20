// The pre-GA host answers one 301 for pages and keeps serving the MCP and
// agent surface, so existing MCP installs keep working after the rebrand.

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { LEGACY_HOST, SITE } from "@/lib/constants";
import {
	isLegacyHost,
	keepsServingOnLegacyHost,
	legacyRedirectTarget,
} from "@/lib/legacy-host";
import { middleware } from "@/middleware";

describe("legacy host routing", () => {
	it("canonical host is orchestkit.dev", () => {
		expect(SITE.domain).toBe("https://orchestkit.dev");
		expect(LEGACY_HOST).toBe("orchestkit.yonyon.ai");
	});

	it("matches the legacy host with or without a port, any case", () => {
		expect(isLegacyHost("orchestkit.yonyon.ai")).toBe(true);
		expect(isLegacyHost("OrchestKit.Yonyon.AI:443")).toBe(true);
		expect(isLegacyHost("orchestkit.dev")).toBe(false);
		expect(isLegacyHost(null)).toBe(false);
	});

	it.each([
		"/api/mcp",
		"/api/mcp/actions",
		"/api/mcp/server-card",
		"/api/search",
		"/mcp",
		"/mcp.json",
		"/ask",
		"/auth.md",
		"/agent/identity",
		"/.well-known/oauth-protected-resource",
		"/.well-known/mcp/server-card.json",
	])("keeps serving %s on the legacy host", (path) => {
		expect(keepsServingOnLegacyHost(path)).toBe(true);
		expect(legacyRedirectTarget(LEGACY_HOST, path, "")).toBeNull();
	});

	it.each([
		["/", "", "https://orchestkit.dev/"],
		["/docs/foundations/overview", "", "https://orchestkit.dev/docs/foundations/overview"],
		["/about", "?ref=x", "https://orchestkit.dev/about?ref=x"],
		["/llms.txt", "", "https://orchestkit.dev/llms.txt"],
		["/sitemap.xml", "", "https://orchestkit.dev/sitemap.xml"],
	])("redirects page %s%s to the canonical host", (path, search, target) => {
		expect(legacyRedirectTarget(LEGACY_HOST, path, search)).toBe(target);
	});

	it("never redirects the canonical host (no loop, no chain)", () => {
		expect(legacyRedirectTarget("orchestkit.dev", "/", "")).toBeNull();
		expect(legacyRedirectTarget("www.orchestkit.dev", "/about", "")).toBeNull();
	});

	it("middleware answers ONE 301 for a legacy page and passes MCP POST through", async () => {
		const page = new NextRequest("https://orchestkit.yonyon.ai/about?x=1", {
			headers: { host: "orchestkit.yonyon.ai", accept: "text/html" },
		});
		const res = await middleware(page);
		expect(res.status).toBe(301);
		expect(res.headers.get("location")).toBe("https://orchestkit.dev/about?x=1");

		const mcp = new NextRequest("https://orchestkit.yonyon.ai/api/mcp", {
			method: "POST",
			headers: {
				host: "orchestkit.yonyon.ai",
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
		});
		const passed = await middleware(mcp);
		expect(passed.status).not.toBe(301);
		expect(passed.headers.get("location")).toBeNull();
	});
});
