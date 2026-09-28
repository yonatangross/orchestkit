import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebMcpSearchForm } from "@/components/webmcp-search-form";
import { buildWebMcpInlineScript, WEBMCP_INLINE_SCRIPT } from "@/lib/webmcp-inline-script";
import {
	declaredToolNames,
	markdownRouteFor,
	registerWebMcpTools,
	skillRouteFor,
	WEBMCP_REGISTRY_KEY,
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
	delete window.__orkWebMcpRegistered;
	document.body.innerHTML = "";
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

/** Run the inline layout script the way the browser parser would: as plain
 * script text against the page globals, with nothing imported. */
function runInline(script: string = WEBMCP_INLINE_SCRIPT) {
	new Function(script)();
}

describe("inline layout script (served HTML registration)", () => {
	it("writes the document.modelContext.registerTool( literal, navigator only as a fallback, no imports", () => {
		const docCall = WEBMCP_INLINE_SCRIPT.indexOf("document.modelContext.registerTool(");
		const navCall = WEBMCP_INLINE_SCRIPT.indexOf("navigator.modelContext.registerTool(");
		expect(docCall).toBeGreaterThan(-1);
		expect(navCall).toBeGreaterThan(docCall);
		expect(WEBMCP_INLINE_SCRIPT).not.toMatch(/\bimport\b|\brequire\(/);
		expect(WEBMCP_INLINE_SCRIPT).toContain(`window["${WEBMCP_REGISTRY_KEY}"]`);
	});

	it("registers every tool on document.modelContext and marks each name inline", () => {
		const registerTool = vi.fn(async () => undefined);
		const navRegister = vi.fn();
		stubModelContext("document", { registerTool });
		stubModelContext("navigator", { registerTool: navRegister });
		runInline();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);
		expect(navRegister).not.toHaveBeenCalled();
		expect(window.__orkWebMcpRegistered).toEqual(
			Object.fromEntries(EXPECTED_TOOLS.map((n) => [n, "inline"])),
		);
	});

	it("falls back to navigator.modelContext.registerTool", () => {
		const registerTool = vi.fn();
		stubModelContext("navigator", { registerTool });
		runInline();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);
	});

	it("inline first, then the chunk provider: each name reaches registerTool once", () => {
		const registerTool = vi.fn(async () => undefined);
		stubModelContext("document", { registerTool });
		runInline();
		registerWebMcpTools();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);
	});

	it("chunk provider first, then inline: still once per name", () => {
		const registerTool = vi.fn(async () => undefined);
		stubModelContext("document", { registerTool });
		registerWebMcpTools();
		runInline();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS);
		expect(window.__orkWebMcpRegistered?.search_docs).toBe("chunk");
	});

	it("skips a name the page declares through <form toolname>, like the chunk path", () => {
		render(<WebMcpSearchForm />);
		const registerTool = vi.fn();
		stubModelContext("document", { registerTool });
		runInline();
		registerWebMcpTools();
		expect(names(registerTool)).toEqual(EXPECTED_TOOLS.filter((n) => n !== "search_docs"));
	});

	it("claims nothing without the API, so the chunk provideContext path keeps the full set", () => {
		runInline();
		expect(window.__orkWebMcpRegistered).toBeUndefined();
		const provideContext = vi.fn();
		stubModelContext("navigator", { provideContext });
		registerWebMcpTools();
		expect(provideContext).toHaveBeenCalledWith({ tools: WEBMCP_TOOLS });
	});

	it("a rejected inline registerTool is logged, never unhandled", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		stubModelContext("document", {
			registerTool: (tool: WebMcpTool) =>
				tool.name === "get_skill"
					? Promise.reject(new DOMException("duplicate", "InvalidStateError"))
					: Promise.resolve(),
		});
		expect(() => runInline()).not.toThrow();
		await new Promise((r) => setTimeout(r, 0));
		expect(warn).toHaveBeenCalledWith(
			"[webmcp] inline registerTool(get_skill) failed",
			expect.any(DOMException),
		);
	});

	it("a rejected inline registerTool releases the name, so the chunk path registers it", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		let failGetSkill = true;
		const registerTool = vi.fn((tool: WebMcpTool) =>
			tool.name === "get_skill" && failGetSkill
				? Promise.reject(new DOMException("not ready", "InvalidStateError"))
				: Promise.resolve(),
		);
		stubModelContext("document", { registerTool });
		runInline();
		await new Promise((r) => setTimeout(r, 0));
		expect(window.__orkWebMcpRegistered?.get_skill).toBeUndefined();
		failGetSkill = false;
		registerWebMcpTools();
		// names() sorts, so the retry shows up as a second get_skill.
		expect(names(registerTool)).toEqual([...EXPECTED_TOOLS, "get_skill"].sort());
		expect(window.__orkWebMcpRegistered?.get_skill).toBe("chunk");
	});

	it("a sync throw in inline registerTool releases the name too", () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		stubModelContext("document", {
			registerTool: vi.fn(() => {
				throw new TypeError("bad schema");
			}),
		});
		runInline();
		expect(window.__orkWebMcpRegistered).toEqual({});
	});

	it("a rejected chunk registerTool releases its claim as well", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		stubModelContext("document", {
			registerTool: (tool: WebMcpTool) =>
				tool.name === "list_skills" ? Promise.reject(new Error("boom")) : Promise.resolve(),
		});
		registerWebMcpTools();
		expect(window.__orkWebMcpRegistered?.list_skills).toBe("chunk");
		await new Promise((r) => setTimeout(r, 0));
		expect(window.__orkWebMcpRegistered?.list_skills).toBeUndefined();
		expect(window.__orkWebMcpRegistered?.get_page).toBe("chunk");
	});

	it("inline execute functions hit the same endpoints with the same results as the chunk tools", async () => {
		const registerTool = vi.fn();
		stubModelContext("document", { registerTool });
		runInline();
		const inline = byName(registerTool.mock.calls.map(([t]) => t as WebMcpTool));
		const chunk = byName(WEBMCP_TOOLS);
		const cases: Array<[string, Record<string, unknown>]> = [
			["search_docs", { query: "install", tag: "skill" }],
			["search_docs", { query: "  " }],
			["get_page", { path: "/docs/foundations/overview" }],
			["get_page", { path: "a/b.md" }],
			["get_page", { path: "/" }],
			["get_page", { path: "%2e%2e/%2e%2e/api/jobs/t" }],
			["get_page", { path: "https://evil.example/x" }],
			["list_skills", {}],
			["get_skill", { name: " Assess " }],
			["get_skill", { name: "..%2fadmin" }],
			["get_skill", { name: "" }],
		];
		const body = JSON.stringify({ skills: [{ name: "assess", description: "Rate it" }] });
		for (const [name, args] of cases) {
			const runOne = async (tool: WebMcpTool) => {
				const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
				vi.stubGlobal("fetch", fetchMock);
				const result = await tool.execute(args);
				return { calls: fetchMock.mock.calls, result };
			};
			const want = await runOne(chunk[name]);
			const got = await runOne(inline[name]);
			expect(got, `${name} ${JSON.stringify(args)}`).toEqual(want);
		}
		const notFound = vi.fn(async () => new Response("", { status: 404 }));
		vi.stubGlobal("fetch", notFound);
		expect(await inline.get_skill.execute({ name: "nope" })).toEqual(
			await chunk.get_skill.execute({ name: "nope" }),
		);
	});

	it("serializes the same names, descriptions and schemas as WEBMCP_TOOLS", () => {
		const registerTool = vi.fn();
		stubModelContext("document", { registerTool });
		runInline();
		const strip = (t: WebMcpTool) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		});
		const got = registerTool.mock.calls.map(([t]) => strip(t as WebMcpTool));
		expect(got).toEqual(WEBMCP_TOOLS.map(strip));
	});

	it("refuses to build when a tool has no inline executor", () => {
		const extra: WebMcpTool = { ...WEBMCP_TOOLS[0], name: "new_tool" };
		expect(() => buildWebMcpInlineScript([...WEBMCP_TOOLS, extra])).toThrow(/new_tool/);
	});

	it("cannot be closed early by a </script> inside tool data", () => {
		const hostile: WebMcpTool = { ...WEBMCP_TOOLS[0], description: "x</script><b>y" };
		expect(buildWebMcpInlineScript([hostile])).not.toMatch(/<\/script/i);
	});

	it("the Window registry property in webmcp.d.ts matches WEBMCP_REGISTRY_KEY", () => {
		const dts = readFileSync(resolve(__dirname, "../webmcp.d.ts"), "utf8");
		expect(dts).toContain(`${WEBMCP_REGISTRY_KEY}?:`);
	});
});
