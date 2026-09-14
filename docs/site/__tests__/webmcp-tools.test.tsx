import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebMcpSearchForm } from "@/components/webmcp-search-form";
import {
	markdownRouteFor,
	registerWebMcpTools,
	WEBMCP_TOOLS,
	type WebMcpTool,
} from "@/lib/webmcp-tools";

const byName = (tools: WebMcpTool[]) =>
	Object.fromEntries(tools.map((t) => [t.name, t]));

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("registerWebMcpTools", () => {
	it("registers search_docs and get_page on document.modelContext first", () => {
		const registerTool = vi.fn();
		const navRegister = vi.fn();
		const surface = registerWebMcpTools(
			{ modelContext: { registerTool } },
			{ modelContext: { registerTool: navRegister, provideContext: vi.fn() } },
		);

		expect(surface).toBe("document.registerTool");
		expect(navRegister).not.toHaveBeenCalled();

		const registered = byName(
			registerTool.mock.calls.map(([tool]) => tool as WebMcpTool),
		);
		for (const name of ["search_docs", "get_page"]) {
			expect(registered[name], name).toBeDefined();
			expect(registered[name].description.length).toBeGreaterThan(20);
			expect(registered[name].inputSchema).toMatchObject({ type: "object" });
			expect(typeof registered[name].execute).toBe("function");
		}
		expect(registered.search_docs.inputSchema).toMatchObject({
			required: ["query"],
		});
	});

	it("falls back to navigator.modelContext.registerTool when document lacks it", () => {
		const registerTool = vi.fn();
		const surface = registerWebMcpTools(
			{},
			{ modelContext: { registerTool } },
		);
		expect(surface).toBe("navigator.registerTool");
		expect(registerTool).toHaveBeenCalledTimes(WEBMCP_TOOLS.length);
	});

	it("falls back to provideContext as the last resort", () => {
		const provideContext = vi.fn();
		const surface = registerWebMcpTools({}, { modelContext: { provideContext } });
		expect(surface).toBe("navigator.provideContext");
		expect(provideContext).toHaveBeenCalledWith({ tools: WEBMCP_TOOLS });
	});

	it("is a no-op without the API", () => {
		expect(registerWebMcpTools({}, {})).toBe("none");
	});
});

describe("tool execute functions hit the existing site APIs", () => {
	it("search_docs calls /api/search with the query and optional tag", async () => {
		const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const tool = byName(WEBMCP_TOOLS).search_docs;

		const result = await tool.execute({ query: "install", tag: "skill" });
		expect(fetchMock).toHaveBeenCalledWith("/api/search?query=install&tag=skill");
		expect(result.content[0]).toEqual({ type: "text", text: "[]" });
	});

	it("get_page fetches the Markdown route for a docs path", async () => {
		const fetchMock = vi.fn(async () => new Response("# Overview", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const tool = byName(WEBMCP_TOOLS).get_page;

		const result = await tool.execute({ path: "/docs/foundations/overview" });
		expect(fetchMock).toHaveBeenCalledWith("/api/md/foundations/overview", {
			headers: { Accept: "text/markdown" },
		});
		expect(result.content[0].text).toBe("# Overview");
	});
});

describe("markdownRouteFor", () => {
	it("normalizes the accepted path shapes", () => {
		expect(markdownRouteFor("/docs/a/b")).toBe("/api/md/a/b");
		expect(markdownRouteFor("docs/a/b")).toBe("/api/md/a/b");
		expect(markdownRouteFor("a/b.md")).toBe("/api/md/a/b");
		expect(markdownRouteFor("/")).toBe("/api/md");
		expect(markdownRouteFor("")).toBe("/api/md");
		expect(markdownRouteFor("/docs")).toBe("/api/md");
	});

	it("refuses absolute URLs and traversal", () => {
		expect(markdownRouteFor("https://evil.example/x")).toBeNull();
		expect(markdownRouteFor("../secret")).toBeNull();
	});
});

describe("WebMcpSearchForm", () => {
	it("renders the declarative toolname and tooldescription attributes", () => {
		const { container } = render(<WebMcpSearchForm />);
		const form = container.querySelector('form[toolname="search_docs"]');
		expect(form).not.toBeNull();
		expect(form?.getAttribute("tooldescription")).toContain("Full-text search");
		expect(form?.getAttribute("action")).toBe("/api/search");
		expect(form?.querySelector('input[name="query"]')).not.toBeNull();
	});
});
