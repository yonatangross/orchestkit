import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebMcpSearchForm } from "@/components/webmcp-search-form";
import {
	declaredToolNames,
	markdownRouteFor,
	registerWebMcpTools,
	skillRouteFor,
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

	it("refuses absolute URLs and plain traversal", () => {
		expect(markdownRouteFor("https://evil.example/x")).toBeNull();
		expect(markdownRouteFor("../secret")).toBeNull();
		expect(markdownRouteFor("a/../b")).toBeNull();
		expect(markdownRouteFor("/docs/./a")).toBeNull();
	});

	it("refuses percent-encoded traversal that the URL parser would normalize", () => {
		// The reviewer's measured escape: the browser decodes %2e%2e AFTER a
		// literal ".." check ran, and new URL() resolves it to /api/jobs/t.
		expect(markdownRouteFor("%2e%2e/%2e%2e/api/jobs/t")).toBeNull();
		expect(markdownRouteFor("%2E%2E/x")).toBeNull();
		expect(markdownRouteFor("..%2fsecret")).toBeNull();
		expect(markdownRouteFor("%2e/a")).toBeNull();
		expect(markdownRouteFor("%zz")).toBeNull();
	});

	it("rejects any segment outside the slug allowlist", () => {
		expect(markdownRouteFor("a/b c")).toBeNull();
		expect(markdownRouteFor("a/B")).toBeNull();
		expect(markdownRouteFor("a/-b")).toBeNull();
		expect(markdownRouteFor("a/b?x=1")).toBeNull();
	});
});

describe("skillRouteFor", () => {
	it("maps a plain skill name, case-insensitively", () => {
		expect(skillRouteFor("assess")).toBe("/docs/reference/skills/assess");
		expect(skillRouteFor(" Assess ")).toBe("/docs/reference/skills/assess");
		expect(skillRouteFor("review-pr")).toBe("/docs/reference/skills/review-pr");
	});

	it("refuses plain and encoded traversal and multi-segment names", () => {
		expect(skillRouteFor("../../../admin")).toBeNull();
		expect(skillRouteFor("%2e%2e/%2e%2e/admin")).toBeNull();
		expect(skillRouteFor("..%2fadmin")).toBeNull();
		expect(skillRouteFor("a/b")).toBeNull();
		expect(skillRouteFor("")).toBeNull();
	});
});

describe("execute never fetches an escaped path", () => {
	it("get_page refuses plain and encoded traversal before fetch", async () => {
		const fetchMock = vi.fn(async () => new Response("x", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const tool = byName(WEBMCP_TOOLS).get_page;
		for (const path of ["../api/jobs/t", "%2e%2e/%2e%2e/api/jobs/t"]) {
			const result = await tool.execute({ path });
			expect(result.content[0].text).toContain("Provide a docs path");
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("get_skill refuses plain and encoded traversal before fetch", async () => {
		const fetchMock = vi.fn(async () => new Response("x", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const tool = byName(WEBMCP_TOOLS).get_skill;
		for (const name of ["../../../admin", "%2e%2e/%2e%2e/admin"]) {
			const result = await tool.execute({ name });
			expect(result.content[0].text).toContain("plain slugs");
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("get_skill still fetches a plain skill name", async () => {
		const fetchMock = vi.fn(async () => new Response("# Assess", { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		await byName(WEBMCP_TOOLS).get_skill.execute({ name: "Assess" });
		expect(fetchMock).toHaveBeenCalledWith("/docs/reference/skills/assess", {
			headers: { Accept: "text/markdown" },
		});
	});
});

describe("registration is guarded and declares each name once", () => {
	it("a throwing registerTool is logged, not thrown, and the rest still register", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const registerTool = vi.fn((tool: WebMcpTool) => {
			if (tool.name === "search_docs") throw new Error("boom");
		});
		expect(() =>
			registerWebMcpTools({ modelContext: { registerTool } }, {}),
		).not.toThrow();
		expect(registerTool).toHaveBeenCalledTimes(WEBMCP_TOOLS.length);
		expect(warn).toHaveBeenCalledWith(
			"[webmcp] registerTool(search_docs) failed",
			expect.any(Error),
		);
		warn.mockRestore();
	});

	it("skips a tool the page already declares through <form toolname>", () => {
		const registerTool = vi.fn();
		const doc = {
			modelContext: { registerTool },
			querySelectorAll: () => [{ getAttribute: () => "search_docs" }],
		};
		expect(declaredToolNames(doc)).toEqual(new Set(["search_docs"]));
		registerWebMcpTools(doc, {});
		const names = registerTool.mock.calls.map(([t]) => (t as WebMcpTool).name);
		expect(names).not.toContain("search_docs");
		expect(names).toContain("get_page");
	});

	it("registers search_docs when no declarative form is present", () => {
		const registerTool = vi.fn();
		registerWebMcpTools(
			{ modelContext: { registerTool }, querySelectorAll: () => [] },
			{},
		);
		const names = registerTool.mock.calls.map(([t]) => (t as WebMcpTool).name);
		expect(names).toContain("search_docs");
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
