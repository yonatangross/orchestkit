import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

// Removing a registration (or a tool) fails the first test: the planted control.
const EXPECTED_TOOLS = ["get_page", "get_skill", "list_skills", "search_docs"];

/** Install a fake ModelContext on the real document / navigator globals, the
 * way Chrome's origin trial exposes it. registerWebMcpTools reads the globals
 * (see the bundle-evidence test below), so the stub has to live there too. */
function stubModelContext(host: "document" | "navigator", ctx: object) {
	Object.defineProperty(host === "document" ? document : navigator, "modelContext", {
		configurable: true,
		get: () => ctx,
	});
}

const names = (fn: { mock: { calls: unknown[][] } }) =>
	fn.mock.calls.map(([t]) => (t as WebMcpTool).name).sort();

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	for (const host of [document, navigator]) {
		if (Object.getOwnPropertyDescriptor(host, "modelContext")) {
			delete (host as { modelContext?: unknown }).modelContext;
		}
	}
});

describe("registerWebMcpTools", () => {
	it("registers every tool on document.modelContext first, with a valid schema", () => {
		const registerTool = vi.fn(async () => undefined);
		const navRegister = vi.fn();
		stubModelContext("document", { registerTool });
		stubModelContext("navigator", { registerTool: navRegister, provideContext: vi.fn() });

		expect(registerWebMcpTools()).toBe("document.registerTool");
		expect(navRegister).not.toHaveBeenCalled();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);

		for (const [tool] of registerTool.mock.calls as unknown as [WebMcpTool][]) {
			// Spec: registerTool rejects an empty name or description, or an
			// invalid inputSchema (it is serialized with JSON.stringify).
			expect(tool.name).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
			expect(tool.description.length, tool.name).toBeGreaterThan(20);
			expect(typeof tool.execute).toBe("function");
			const schema = tool.inputSchema as {
				type: string;
				properties: Record<string, { type: string }>;
				required?: string[];
			};
			expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
			expect(schema.type, tool.name).toBe("object");
			for (const prop of Object.values(schema.properties)) {
				expect(prop.type, tool.name).toBe("string");
			}
			for (const key of schema.required ?? []) {
				expect(Object.keys(schema.properties), tool.name).toContain(key);
			}
		}
	});

	it("falls back to navigator.modelContext.registerTool when document lacks it", () => {
		const registerTool = vi.fn();
		stubModelContext("navigator", { registerTool });
		expect(registerWebMcpTools()).toBe("navigator.registerTool");
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);
	});

	it("falls back to provideContext as the last resort", () => {
		const provideContext = vi.fn();
		stubModelContext("navigator", { provideContext });
		expect(registerWebMcpTools()).toBe("navigator.provideContext");
		expect(provideContext).toHaveBeenCalledWith({ tools: WEBMCP_TOOLS });
	});

	it("is a no-op without the API", () => {
		expect(registerWebMcpTools()).toBe("none");
	});

	it("reads document.modelContext on the global, so the bundle carries the literal", () => {
		// orank scans same-origin JS bundles for document.modelContext
		// registrations. A helper that took `doc` as a parameter minified to
		// `i=e.modelContext`, and the 2026-09-27 scan saw only the form.
		const src = readFileSync(resolve(__dirname, "../lib/webmcp-tools.ts"), "utf8");
		expect(src).toContain("? document.modelContext.registerTool(tool)");
		expect(src).toContain("? navigator.modelContext.registerTool(tool)");
		expect(src).not.toMatch(/\(\s*doc\s+as\s+HasModelContext\s*\)/);
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
		stubModelContext("document", { registerTool });
		expect(() => registerWebMcpTools()).not.toThrow();
		expect(registerTool).toHaveBeenCalledTimes(WEBMCP_TOOLS.length);
		expect(warn).toHaveBeenCalledWith(
			"[webmcp] registerTool(search_docs) failed",
			expect.any(Error),
		);
	});

	it("a rejected registerTool promise is caught and logged, never unhandled", async () => {
		// Spec: registerTool returns a Promise that rejects on a duplicate name.
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		stubModelContext("document", {
			registerTool: (tool: WebMcpTool) =>
				tool.name === "get_page"
					? Promise.reject(new DOMException("duplicate", "InvalidStateError"))
					: Promise.resolve(),
		});
		expect(() => registerWebMcpTools()).not.toThrow();
		await new Promise((r) => setTimeout(r, 0));
		expect(warn).toHaveBeenCalledWith(
			"[webmcp] registerTool(get_page) failed",
			expect.any(DOMException),
		);
	});

	it("skips a tool the page already declares through <form toolname>", () => {
		const doc = {
			querySelectorAll: () => [{ getAttribute: () => "search_docs" }],
		};
		expect(declaredToolNames(doc)).toEqual(new Set(["search_docs"]));
		render(<WebMcpSearchForm />);
		const registerTool = vi.fn();
		stubModelContext("document", { registerTool });
		registerWebMcpTools();
		expect(names(registerTool)).toEqual(
			EXPECTED_TOOLS.filter((n) => n !== "search_docs"),
		);
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
