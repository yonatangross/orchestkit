// Home agents block, look 05 "Scoreboard with proof" (his pick, KB 3a1198ac;
// approved design: components/approved-design/agents-block-look05.html).
// Server-rendered first: every surface, its proof and its check date are text
// in the server HTML (renderToStaticMarkup, no JS), nothing behind a closed
// accordion, tab or details; the ring is a drawing with aria-hidden.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentReadinessSection } from "@/components/agent-readiness-section";

const SURFACES = [
	"llms.txt",
	"llms-full.txt",
	"Markdown for every page",
	"NLWeb questions",
	"Sitemap",
	"Structured data",
	"MCP server",
	"Actions MCP",
	"WebMCP in the browser",
	"OpenAPI spec",
	"robots.txt AI rules",
	"Agent card and catalogs",
	"MCP registry listing",
	"skills.sh",
];

const html = () => renderToStaticMarkup(<AgentReadinessSection />);
const text = () =>
	html()
		.replace(/<svg[\s\S]*?<\/svg>/g, " ")
		// Path wraps segments in spans with <wbr>: inline, so no space.
		.replace(/<\/?(span|wbr|code|a|strong)\b[^>]*>/g, "")
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ");

describe("agents block, look 05 scoreboard", () => {
	it("keeps the heading and the cross-harness lead", () => {
		const t = text();
		expect(html()).toContain('id="agents-heading"');
		expect(t).toContain("Built for AI agents, too");
		expect(t).toContain("Skills and agents work in Claude Code, Codex, Cursor and other harnesses");
		expect(t).toContain("hooks currently need Claude Code");
		expect(t).not.toMatch(/Claude Code only/i);
	});

	it("states the score as text", () => {
		expect(text()).toContain(`${SURFACES.length} agent surfaces.`);
		expect(text()).toContain(`${SURFACES.length} checked live or on main on 15 Nov 2026`);
	});

	it("lists every surface in an ordered list, each with proof and its check date", () => {
		const h = html();
		const items = h.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
		expect(items).toHaveLength(SURFACES.length);
		SURFACES.forEach((name, i) => {
			const li = items[i].replace(/<[^>]+>/g, "");
			expect(li, name).toContain(name);
			expect(li, name).toContain("checked 15 Nov 2026");
		});
		expect(h).toMatch(/<ol\b/);
	});

	it("carries the proof facts from the status file", () => {
		const t = text();
		for (const fact of [
			"89 lines",
			"4,155 lines",
			"352 URLs",
			"two read-only tools",
			"11 named AI bots allowed",
			"io.github.yonatangross/orchestkit",
			"npx skills add yonatangross/orchestkit",
		]) {
			expect(t, fact).toContain(fact);
		}
	});

	it("keeps the old block's crawl paths as one plain link line under the scoreboard (oc20 ruling)", () => {
		const h = html();
		const after = h.slice(h.indexOf("</ol>"));
		for (const href of [
			'href="/docs/sdk"',
			'href="https://smithery.ai/servers/yonaigross/orchestkit"',
			'href="https://mcp.so/server/orchestkit/yonaigross"',
			'href="/auth.md"',
			'href="/docs/guides/ask-fallback"',
		]) {
			expect(after, href).toContain(href);
		}
		expect(after).toContain("toolname=&quot;search_docs&quot;");
	});

	it("hides nothing and marks the drawing as decoration", () => {
		const h = html();
		expect(h).not.toMatch(/<details|\shidden[\s>=]|role="tab"/);
		expect(h).toMatch(/<svg[^>]*aria-hidden="true"/);
		expect(text()).not.toMatch(/\bCLAIMED\b|\bVERIFIED\b/);
	});
});
