// The three MCP App views are one custom element each, drawn on the site's
// generated tokens (approved design: before and after on the real tokens).

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { MCP_UI_DARK_TOKENS, MCP_UI_LIGHT_TOKENS } from "@/lib/generated/mcp-ui-tokens";
import { SEARCH_RESULTS_HTML } from "@/lib/mcp-ui";
import { INSTALL_PICKER_HTML, SKILL_CARD_HTML } from "@/lib/mcp-ui-cards";
import { renderSourcesModule } from "../scripts/generate-mcp-ui-tokens.mjs";
import { bootView, CLAUDE_PROXY, initResult, toolResult } from "./helpers/mcp-view";

const SITE_DIR = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(SITE_DIR, rel), "utf8");

const VIEWS = [
	["ork-search-results", SEARCH_RESULTS_HTML],
	["ork-skill-card", SKILL_CARD_HTML],
	["ork-install-picker", INSTALL_PICKER_HTML],
] as const;

const hit = (n: number, extra: Record<string, unknown> = {}) => ({
	id: `h${n}`,
	title: `Page ${n}`,
	url: `https://orchestkit.dev/docs/page-${n}`,
	content: `Snippet ${n}`,
	...extra,
});

const SKILL = {
	found: true,
	name: "brainstorm",
	summary: "Design ideation with parallel agents.",
	useWhen: "Use when brainstorming.",
	plugin: "ork",
	version: "4.10.0",
	invoke: "/ork:brainstorm",
	installCommand: "first command && second command",
	docsUrl: "https://orchestkit.dev/docs/reference/skills/brainstorm",
};

describe("no color is typed into a view", () => {
	const files = [
		"lib/mcp-ui.ts",
		"lib/mcp-ui-cards.ts",
		"lib/mcp-app/document.ts",
		"lib/mcp-app/base.js",
		"lib/mcp-app/views.css",
		...readdirSync(resolve(SITE_DIR, "lib/mcp-app/components")).map((f) => `lib/mcp-app/components/${f}`),
	];

	it.each(files)("%s has no hex literal", (file) => {
		expect(read(file).match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g)).toBeNull();
	});

	it("the committed sources module matches lib/mcp-app", () => {
		expect(read("lib/generated/mcp-app-sources.ts")).toBe(renderSourcesModule(SITE_DIR));
	});
});

describe.each(VIEWS)("%s", (tag, html) => {
	it("is one titled document that mounts its custom element on the site tokens", () => {
		expect(html).toMatch(/<title>[^<]+<\/title>/);
		expect(html).toContain(MCP_UI_LIGHT_TOKENS["--color-fd-primary-solid"]);
		expect(html).toContain(MCP_UI_DARK_TOKENS["--color-fd-primary-solid"]);
		expect(html).not.toContain("innerHTML");
		expect(bootView(html).element.tagName.toLowerCase()).toBe(tag);
	});

	it("opens with the ui/initialize handshake and says it is waiting", () => {
		const { app, sent } = bootView(html);
		expect(sent[0]).toMatchObject({ message: { method: "ui/initialize", id: 1 }, target: "*" });
		expect(app.textContent).toMatch(/Waiting for .+ from the host/);
	});

	it("follows the host theme, at the handshake and when it changes", () => {
		const { element, deliver } = bootView(html);
		expect(element.hasAttribute("data-theme")).toBe(false);
		deliver(initResult({ hostContext: { theme: "dark" } }));
		expect(element.getAttribute("data-theme")).toBe("dark");
		deliver({ jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "light" } });
		expect(element.getAttribute("data-theme")).toBe("light");
	});

	it("takes the host font variables and nothing else from its styles", () => {
		const { element, deliver } = bootView(html);
		deliver(
			initResult({
				hostContext: { styles: { variables: { "--font-sans": "Geist", "--color-fd-primary": "red" } } },
			}),
		);
		expect(element.style.getPropertyValue("--font-sans")).toBe("Geist");
		expect(element.style.getPropertyValue("--color-fd-primary")).toBe("");
	});

	it.each(["ping", "ui/resource-teardown"])("answers %s at the pinned origin", (method) => {
		const { deliver, sent } = bootView(html);
		deliver({ jsonrpc: "2.0", id: 41, method });
		expect(sent).toContainEqual({ message: { jsonrpc: "2.0", id: 41, result: {} }, target: CLAUDE_PROXY });
	});
});

describe("search results", () => {
	it("lists the first five of the hits as a list of links, with their paths", () => {
		const { app, deliver } = bootView(SEARCH_RESULTS_HTML);
		deliver(toolResult({ results: [1, 2, 3, 4, 5, 6, 7].map((n) => hit(n)) }));
		const list = app.querySelector('ul[role="list"]');
		expect(list?.querySelectorAll("li")).toHaveLength(5);
		expect(app.textContent).toContain("Top 5 of 7 pages");
		const link = app.querySelector("li a");
		expect(link?.getAttribute("href")).toBe("https://orchestkit.dev/docs/page-1");
		expect(app.textContent).toContain("/docs/page-1");
	});

	it("writes titles and snippets as text", () => {
		const { app, deliver } = bootView(SEARCH_RESULTS_HTML);
		deliver(
			toolResult({
				results: [hit(1, { title: '<img src=x onerror="p()">', content: "<b>bold</b>" })],
			}),
		);
		expect(app.querySelector("img, b b")).toBeNull();
		expect(app.textContent).toContain('<img src=x onerror="p()">');
		expect(app.textContent).toContain("<b>bold</b>");
	});

	it.each([
		"javascript:alert(1)",
		"http://orchestkit.dev/docs/x",
		"https://orchestkit.dev.attacker.example/docs/x",
		"https://orchestkit.dev:8443/docs/x",
		"https://user@orchestkit.dev/docs/x",
		"//evil.example/x",
	])("does not link %s", (url) => {
		const { app, deliver } = bootView(SEARCH_RESULTS_HTML);
		deliver(toolResult({ results: [hit(1, { url })] }));
		expect(app.textContent).toContain("Page 1");
		expect(app.querySelector("a")).toBeNull();
	});

	it("says what to try when nothing matched", () => {
		const { app, deliver } = bootView(SEARCH_RESULTS_HTML);
		deliver(toolResult({ results: [] }));
		expect(app.textContent).toContain("No matching documentation. Try a shorter query.");
	});

	it("ignores results from any window other than the parent", () => {
		const { app, deliver } = bootView(SEARCH_RESULTS_HTML);
		deliver(toolResult({ results: [hit(1)] }), CLAUDE_PROXY, {});
		expect(app.textContent).toContain("Waiting for results");
	});

	it("asks a host that opens links to open it, and otherwise leaves the link native", () => {
		for (const [hostCapabilities, handled] of [
			[{ openLinks: {} }, true],
			[{}, false],
		] as const) {
			const { app, deliver, sent } = bootView(SEARCH_RESULTS_HTML);
			deliver(initResult({ hostCapabilities }));
			deliver(toolResult({ results: [hit(1)] }));
			// Read the link's own verdict on the way up, then stop the test DOM
			// from navigating.
			let prevented: boolean | undefined;
			app.addEventListener("click", (e) => {
				prevented = e.defaultPrevented;
				e.preventDefault();
			});
			app.querySelector("li a")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
			expect(prevented).toBe(handled);
			expect(sent.some((s) => s.message.method === "ui/open-link")).toBe(handled);
		}
	});

	it("reads a ChatGPT tool output and theme", () => {
		const { app, element } = bootView(SEARCH_RESULTS_HTML, {
			openai: { toolOutput: { results: [hit(1)] }, theme: "dark" },
		});
		expect(app.textContent).toContain("Page 1");
		expect(element.getAttribute("data-theme")).toBe("dark");
	});
});

describe("skill card", () => {
	it("shows the name, plugin, version, run line and install card", () => {
		const { app, deliver } = bootView(SKILL_CARD_HTML);
		deliver(toolResult(SKILL));
		expect(app.querySelector("h1")?.textContent).toBe("brainstorm");
		expect(app.querySelector(".tag")?.textContent).toBe("ork plugin");
		expect(app.querySelector(".stat")?.textContent).toContain("v4.10.0");
		expect(app.querySelector(".stat")?.textContent).toContain("run /ork:brainstorm");
		expect(app.querySelectorAll("pre .ln")).toHaveLength(2);
		const copy = app.querySelector("button[data-copy]");
		expect(copy?.textContent).toBe("Copy");
		expect(copy?.getAttribute("aria-label")).toBe("Copy both commands");
		expect(copy?.getAttribute("data-copy")).toBe("first command && second command");
	});

	it("keeps the copy status outside the button", async () => {
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		const { app, deliver } = bootView(SKILL_CARD_HTML);
		deliver(toolResult(SKILL));
		const copy = app.querySelector<HTMLButtonElement>("button[data-copy]");
		copy?.click();
		await new Promise((r) => setTimeout(r, 0));
		expect(writeText).toHaveBeenCalledWith("first command && second command");
		expect(app.querySelector('[role="status"]')?.textContent).toContain("Copied to the clipboard.");
		expect(copy?.querySelector('[role="status"]')).toBeNull();
		expect(copy?.disabled).toBe(false);
	});
});

describe("install picker", () => {
	const hosts = {
		selected: "a",
		hosts: ["a", "b"].map((id) => ({
			id,
			name: `Host ${id}`,
			what: `What ${id}`,
			where: `Where ${id}`,
			commands: [`install ${id}`],
			prompt: true,
			then: { label: `Then run in Host ${id}`, commands: ["/setup"], prompt: false },
		})),
	};

	it("keeps the same radios on the page when the host changes, so focus stays", () => {
		const { app, deliver } = bootView(INSTALL_PICKER_HTML);
		deliver(toolResult(hosts));
		const second = app.querySelector<HTMLInputElement>('input[value="b"]');
		expect(second).not.toBeNull();
		if (!second) return;
		second.checked = true;
		second.dispatchEvent(new Event("change", { bubbles: true }));
		expect(app.querySelector('input[value="b"]')).toBe(second);
		expect(app.textContent).toContain("install b");
		expect(app.textContent).toContain("Then run in Host b");
		expect(app.textContent).not.toContain("install a");
	});
});
