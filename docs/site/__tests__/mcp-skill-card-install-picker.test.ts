// MCP App cards: a skill card and an install picker in the docs MCP.
// Red first: these fail on main (no orchestkit_skill_get, no orchestkit_install,
// no ui://orchestkit/skill-card or ui://orchestkit/install-picker).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { SITE } from "@/lib/constants";
import { SKILLS } from "@/lib/generated/skills-data";

vi.mock("@/lib/doc-markdown", () => ({ getDocMarkdown: async () => null }));
vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: () => {} }));

const REPO = resolve(__dirname, "../../..");
const readJson = (rel: string) => JSON.parse(readFileSync(resolve(REPO, rel), "utf8"));

async function rpc(method: string, params: Record<string, unknown> = {}) {
	const { POST } = await import("@/app/api/mcp/route");
	const res = await POST(
		new Request("https://orchestkit.dev/api/mcp", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
		}),
	);
	return (await res.json()).result;
}

const SKILL_URI = "ui://orchestkit/skill-card";
const PICKER_URI = "ui://orchestkit/install-picker";

describe("tools and resources list", () => {
	it("lists the two new tools bound to their ui:// URIs under both _meta keys", async () => {
		const { tools } = await rpc("tools/list");
		const byName = Object.fromEntries(tools.map((t: { name: string }) => [t.name, t]));
		for (const [name, uri] of [
			["orchestkit_skill_get", SKILL_URI],
			["orchestkit_install", PICKER_URI],
		] as const) {
			const t = byName[name];
			expect(t, name).toBeDefined();
			expect(t._meta.ui.resourceUri, name).toBe(uri);
			expect(t._meta["openai/outputTemplate"], name).toBe(uri);
			expect(t.annotations.readOnlyHint, name).toBe(true);
			expect(t.annotations.destructiveHint, name).toBe(false);
			expect(t.outputSchema?.type, name).toBe("object");
		}
		// The two tools that were already there are still there, still bound.
		expect(byName.orchestkit_docs_search._meta.ui.resourceUri).toBe(
			"ui://orchestkit/search-results",
		);
		expect(byName.orchestkit_docs_get).toBeDefined();
	});

	it("lists both resources as text/html;profile=mcp-app and serves them", async () => {
		const { resources } = await rpc("resources/list");
		for (const uri of [SKILL_URI, PICKER_URI]) {
			const r = resources.find((x: { uri: string }) => x.uri === uri);
			expect(r, uri).toBeDefined();
			expect(r.mimeType).toBe("text/html;profile=mcp-app");
			const read = await rpc("resources/read", { uri });
			expect(read.contents[0].uri).toBe(uri);
			expect(read.contents[0].mimeType).toBe("text/html;profile=mcp-app");
			expect(read.contents[0].text).toMatch(/^<!doctype html>/i);
		}
	});

	it("keeps both views inside the CSP rules: no external script, no network", async () => {
		for (const uri of [SKILL_URI, PICKER_URI]) {
			const { contents } = await rpc("resources/read", { uri });
			const html: string = contents[0].text;
			const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";
			expect(csp, uri).toContain("default-src 'none'");
			expect(csp, uri).toContain("connect-src 'none'");
			expect(csp, uri).toContain("frame-ancestors https://chatgpt.com https://claude.ai");
			expect(csp, uri).toContain("form-action 'none'");
			expect(csp, uri).not.toMatch(/(^|\s)\*/);
			expect(csp, uri).not.toContain("'unsafe-eval'");
			expect(html, uri).not.toMatch(/<script[^>]+src=/i);
			expect(html, uri).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
			expect(html, uri).toContain('<meta name="color-scheme" content="light dark"');
			expect(html, uri).toContain("width=device-width");
		}
	});

	it("server instructions and the server card describe the new tools", async () => {
		const init = await rpc("initialize", { protocolVersion: "2025-06-18" });
		expect(init.instructions).toContain("orchestkit_skill_get");
		expect(init.instructions).toContain("orchestkit_install");
		const { GET } = await import("@/app/api/well-known/mcp-server-card/route");
		const card = await (await GET()).json();
		const names = card.tools.map((t: { name: string }) => t.name);
		expect(names).toEqual(
			expect.arrayContaining(["orchestkit_skill_get", "orchestkit_install"]),
		);
		for (const t of card.tools) expect(t.annotations.readOnlyHint, t.name).toBe(true);
	});

	it("registry server.json description mentions the cards", () => {
		const server = readJson("server.json");
		expect(server.description).toMatch(/skill card/i);
		expect(server.description).toMatch(/install/i);
	});

	it("attributes all hosted tools and only the two docs tools to stdio", async () => {
		const { GET } = await import("@/app/api/well-known/mcp-server-card/route");
		const card = await (await GET()).json();
		const { tools: hostedTools } = await rpc("tools/list");
		const namesOn = (transport: string) =>
			card.tools
				.filter((tool: { transports: string[] }) => tool.transports.includes(transport))
				.map((tool: { name: string }) => tool.name)
				.sort();

		expect(namesOn("streamable-http")).toEqual(
			hostedTools.map((tool: { name: string }) => tool.name).sort(),
		);
		expect(namesOn("stdio")).toEqual(["orchestkit_docs_get", "orchestkit_docs_search"]);
	});
});

describe("orchestkit_skill_get", () => {
	it("returns a card for one real skill, from the generated skills data", async () => {
		const real = SKILLS["brainstorm"];
		expect(real, "brainstorm must exist in skills-data").toBeDefined();
		const r = await rpc("tools/call", {
			name: "orchestkit_skill_get",
			arguments: { name: "brainstorm" },
		});
		expect(r.isError).toBeUndefined();
		expect(r._meta.ui.resourceUri).toBe(SKILL_URI);
		expect(r.structuredContent).toMatchObject({
			found: true,
			name: "brainstorm",
			description: real.description,
			plugin: real.plugins[0],
			version: real.version,
		});
		expect(r.structuredContent.installCommand).toBe(
			"claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork@orchestkit",
		);
		expect(r.structuredContent.installCommand).toBe(SITE.installCommand);
		expect(r.content[0].text).toContain("brainstorm");
	});

	it("names ork-extras and its own install line for a skill that ships there", async () => {
		const extras = Object.values(SKILLS).find((s) => s.plugins.includes("ork-extras"));
		expect(extras).toBeDefined();
		const r = await rpc("tools/call", {
			name: "orchestkit_skill_get",
			arguments: { name: extras!.name },
		});
		expect(r.structuredContent.plugin).toBe("ork-extras");
		expect(r.structuredContent.installCommand).toBe(
			"claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork-extras@orchestkit",
		);
	});

	it("an unknown name is a 'no such skill' card with the nearest names, not an error or an empty frame", async () => {
		const r = await rpc("tools/call", {
			name: "orchestkit_skill_get",
			arguments: { name: "brainstorn" },
		});
		expect(r.isError).toBeUndefined();
		expect(r._meta.ui.resourceUri).toBe(SKILL_URI);
		expect(r.structuredContent.found).toBe(false);
		expect(r.structuredContent.query).toBe("brainstorn");
		expect(r.structuredContent.suggestions).toContain("brainstorm");
		expect(r.structuredContent.suggestions.length).toBeLessThanOrEqual(5);
		expect(r.content[0].text).toMatch(/no such skill/i);
		expect(r.content[0].text).toContain("brainstorm");
	});

	it("a missing name is a plain input error with no card", async () => {
		const r = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: {} });
		expect(r.isError).toBe(true);
		expect(r.structuredContent).toBeUndefined();
	});
});

describe("orchestkit_install", () => {
	it("returns the three hosts with their exact commands, Claude Code first", async () => {
		const r = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		expect(r._meta.ui.resourceUri).toBe(PICKER_URI);
		const hosts = r.structuredContent.hosts as Array<{ id: string; commands: string[]; copy: string }>;
		expect(hosts.map((h) => h.id)).toEqual(["claude", "cursor", "codex"]);
		expect(r.structuredContent.selected).toBe("claude");
	});

	it("preselects the requested host, and falls back to Claude Code for an unknown one", async () => {
		const cursor = await rpc("tools/call", { name: "orchestkit_install", arguments: { host: "cursor" } });
		expect(cursor.structuredContent.selected).toBe("cursor");
		const odd = await rpc("tools/call", { name: "orchestkit_install", arguments: { host: "emacs" } });
		expect(odd.isError).toBeUndefined();
		expect(odd.structuredContent.selected).toBe("claude");
	});
});

describe("each host's install command equals the manifest text", () => {
	async function hostsFromTool() {
		const r = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		return Object.fromEntries(
			(r.structuredContent.hosts as Array<{ id: string; commands: string[]; copy: string }>).map((h) => [h.id, h]),
		);
	}

	it("Claude Code: marketplace name and plugin name come from .claude-plugin/marketplace.json", async () => {
		const m = readJson(".claude-plugin/marketplace.json");
		expect(m.plugins.map((p: { name: string }) => p.name)).toContain("ork");
		const claude = (await hostsFromTool()).claude;
		expect(claude.copy).toBe(
			`claude plugin marketplace add yonatangross/orchestkit && claude plugin install ork@${m.name}`,
		);
		expect(claude.commands).toEqual([
			"claude plugin marketplace add yonatangross/orchestkit",
			`claude plugin install ork@${m.name}`,
		]);
	});

	it("Cursor: the marketplace slug is the repo, and .cursor-plugin/marketplace.json ships ork", async () => {
		const m = readJson(".cursor-plugin/marketplace.json");
		expect(m.plugins.map((p: { name: string }) => p.name)).toContain("ork");
		expect(SITE.github).toBe("https://github.com/yonatangross/orchestkit");
		const cursor = (await hostsFromTool()).cursor;
		expect(cursor.commands).toEqual(["yonatangross/orchestkit"]);
		expect(cursor.copy).toBe("yonatangross/orchestkit");
	});

	it("Codex: plugin and marketplace names come from .agents/plugins/marketplace.json", async () => {
		const m = readJson(".agents/plugins/marketplace.json");
		const plugin = m.plugins[0];
		expect(plugin.name).toBe("ork-codex");
		const codex = (await hostsFromTool()).codex;
		expect(codex.commands).toEqual([
			"codex plugin marketplace add yonatangross/orchestkit --ref main --sparse .agents/plugins --sparse plugins/ork-codex",
			`codex plugin add ${plugin.name}@${m.name}`,
		]);
	});
});

// The frame runs the card's own script, so render each view for real data in the
// test DOM: build the body from the served HTML, set the host's toolOutput, run it.
// The served HTML is parsed with the DOM's own parser (a parsed document never
// runs its scripts), so no regex has to recognise a script tag.
function mount(html: string, toolOutput: unknown) {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const scripts = [...doc.body.querySelectorAll("script")];
	const script = scripts[0]?.textContent ?? "";
	for (const el of scripts) el.remove();
	document.body.innerHTML = doc.body.innerHTML;
	(window as unknown as { openai: unknown }).openai = { toolOutput };
	(0, eval)(script);
}

async function viewHtml(uri: string): Promise<string> {
	const { contents } = await rpc("resources/read", { uri });
	return contents[0].text;
}

describe("skill card renders", () => {
	it("a real skill: name, description, plugin, install line and a native copy button", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: { name: "brainstorm" } });
		mount(await viewHtml(SKILL_URI), call.structuredContent);
		const text = document.body.textContent ?? "";
		const real = SKILLS["brainstorm"];
		expect(text).toContain("brainstorm");
		// The card shows the leading sentence and the "Use when" sentence, both cut
		// from the real description; the routing text after them is not shown.
		expect(call.structuredContent.summary.length).toBeGreaterThan(0);
		expect(real.description.startsWith(call.structuredContent.summary)).toBe(true);
		expect(text).toContain(call.structuredContent.summary);
		expect(call.structuredContent.useWhen).toMatch(/^Use when/);
		expect(real.description).toContain(call.structuredContent.useWhen);
		expect(text).toContain(call.structuredContent.useWhen);
		expect(text).not.toContain("Not for building");
		expect(text).toContain("Ships in the ork plugin");
		// Install first, then run: the install block comes before the run block.
		const installLines = SITE.installCommand.split(" && ");
		for (const line of installLines) expect(text).toContain(line);
		expect(text.indexOf("Install in Claude Code")).toBeLessThan(text.indexOf("Then run /ork:brainstorm in Claude Code."));
		expect(text).toContain("/ork:brainstorm");
		const btn = document.querySelector("button[data-copy]") as HTMLButtonElement | null;
		expect(btn, "copy button").not.toBeNull();
		expect(btn!.tagName).toBe("BUTTON");
		expect(btn!.getAttribute("type")).toBe("button");
		expect(btn!.getAttribute("data-copy")).toBe(SITE.installCommand);
	});

	it("an unknown name: 'no such skill' with the nearest names, never an empty frame", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: { name: "brainstorn" } });
		mount(await viewHtml(SKILL_URI), call.structuredContent);
		const text = document.body.textContent ?? "";
		// A headline with the answer, the typed name quoted, and a path forward.
		expect(document.querySelector("h1")?.textContent).toBe("Did you mean brainstorm?");
		expect(text).toContain("OrchestKit has no skill named brainstorn.");
		expect(document.querySelector("button[data-copy]")).toBeNull();
		// The suggestion is a real button, and the typed name is set apart in code style.
		expect(document.querySelector(".code")?.textContent).toBe("brainstorn");
		const show = document.querySelector(".near button") as HTMLButtonElement;
		expect(show.tagName).toBe("BUTTON");
		expect(show.textContent).toBe("Show brainstorm");
		// A way out when the suggestion is wrong: the full skill list.
		const all = [...document.querySelectorAll("a")].find((a) => a.textContent?.startsWith("Browse all skills"));
		expect(all?.getAttribute("href")).toBe(`${SITE.domain}/docs/reference/skills`);
	});

	it("the suggestion button asks the host for that skill's card, with no request from the frame", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: { name: "brainstorn" } });
		mount(await viewHtml(SKILL_URI), call.structuredContent);
		const sent = vi.fn();
		(window as unknown as { openai: unknown }).openai = { sendFollowUpMessage: sent };
		(document.querySelector(".near button") as HTMLButtonElement).click();
		expect(sent).toHaveBeenCalledWith({ prompt: "Show me the OrchestKit skill card for brainstorm" });
		expect(document.body.textContent).toContain("Asked.");
	});

	it("an unknown name with nothing close says so and points at the docs search", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: { name: "zzzzzzzz" } });
		expect(call.structuredContent).toMatchObject({ found: false, suggestions: [] });
		mount(await viewHtml(SKILL_URI), call.structuredContent);
		expect(document.querySelector("h1")?.textContent).toBe("No such skill");
		expect(document.body.textContent).toContain("orchestkit_docs_search");
	});

	it("long, short and missing content still render: a 200-character name, an empty description", async () => {
		const longName = "x".repeat(200);
		mount(await viewHtml(SKILL_URI), {
			found: true,
			name: longName,
			description: "",
			summary: "",
			useWhen: null,
			plugin: "ork",
			version: "1.0.0",
			invoke: null,
			installCommand: SITE.installCommand,
			docsUrl: `${SITE.domain}/docs/reference/skills/${longName}`,
		});
		expect(document.querySelector("h1")?.textContent).toBe(longName);
		expect(document.querySelector("button[data-copy]")).not.toBeNull();
		expect(document.body.textContent).not.toContain("Then run");
	});

	it("the picker names the host first, then where to paste, then the command; all hosts say 'Then run in'", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: { host: "codex" } });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		const text = document.body.textContent ?? "";
		const codex = (call.structuredContent.hosts as Array<{ id: string; what: string; where: string }>).find((h) => h.id === "codex")!;
		expect(text.indexOf(codex.what)).toBeLessThan(text.indexOf(codex.where));
		expect(text.indexOf(codex.what)).toBeLessThan(text.indexOf("Copy both commands"));
		for (const h of call.structuredContent.hosts as Array<{ then: { label: string } | null }>) {
			expect(h.then?.label).toMatch(/^Then run in /);
		}
		expect(text).toContain("Then run in a Codex chat");
	});

	it("the skill card offers the install picker for other hosts, as a button that asks the host", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_skill_get", arguments: { name: "brainstorm" } });
		mount(await viewHtml(SKILL_URI), call.structuredContent);
		expect(document.querySelector("button[data-copy]")?.textContent).toBe("Copy both commands");
		const sent = vi.fn();
		(window as unknown as { openai: unknown }).openai = { sendFollowUpMessage: sent };
		(document.querySelector("button.text") as HTMLButtonElement).click();
		expect(sent).toHaveBeenCalledWith({ prompt: "Show me how to install OrchestKit in Cursor or Codex" });
	});

	it("a command block wraps inside its box instead of running past it (390 px regression)", async () => {
		for (const uri of [SKILL_URI, PICKER_URI]) {
			const html = await viewHtml(uri);
			expect(/pre\{[^}]*white-space:pre-wrap/.test(html), uri).toBe(true);
			expect(/\.t\{white-space:nowrap\}/.test(html), uri).toBe(true);
		}
	});

	it("copying shows a visible confirmation next to the button, with a check mark", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		const writeText = vi.fn(async () => {});
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		(document.querySelector("button[data-copy]") as HTMLButtonElement).click();
		await new Promise((r) => setTimeout(r, 0));
		expect(writeText).toHaveBeenCalledWith(SITE.installCommand);
		const status = document.querySelector('[role="status"]');
		expect(status?.textContent).toBe("✓ Copied to the clipboard.");
	});

	it("a command wraps between words, never inside one: every word is a no-wrap unit", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: { host: "codex" } });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		const words = [...document.querySelectorAll("pre .t")].map((n) => n.textContent);
		expect(words).toContain("ork-codex@orchestkit-codex");
		expect(words).toContain("--sparse");
		expect(words.some((w) => w?.includes(" "))).toBe(false);
	});

	it("renders text as text: a hostile description cannot inject markup", async () => {
		mount(await viewHtml(SKILL_URI), {
			found: true,
			name: "x",
			description: '<img src=x onerror="window.__pwned=1">',
			plugin: "ork",
			version: "1.0.0",
			installCommand: SITE.installCommand,
			docsUrl: `${SITE.domain}/docs/reference/skills/x`,
		});
		expect(document.querySelector("img")).toBeNull();
		expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
	});

	it("before any data arrives the frame says what it is waiting for, not blank", async () => {
		mount(await viewHtml(SKILL_URI), undefined);
		expect((document.body.textContent ?? "").trim().length).toBeGreaterThan(0);
	});
});

describe("install picker renders", () => {
	it("three native radios, Claude Code checked, its command and a copy button shown", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		const radios = [...document.querySelectorAll('input[type="radio"][name="host"]')] as HTMLInputElement[];
		expect(radios.map((r) => r.value)).toEqual(["claude", "cursor", "codex"]);
		expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual(["claude"]);
		expect(document.querySelector("fieldset legend")).not.toBeNull();
		for (const r of radios) expect(document.querySelector(`label[for="${r.id}"]`), r.value).not.toBeNull();
		expect(document.body.textContent).toContain("claude plugin install ork@orchestkit");
		const btn = document.querySelector("button[data-copy]") as HTMLButtonElement;
		expect(btn.getAttribute("data-copy")).toBe(SITE.installCommand);
	});

	it("picking a host swaps the command and the copy payload with no network call", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		const fetchSpy = vi.fn();
		(globalThis as unknown as { fetch: unknown }).fetch = fetchSpy;
		const codex = document.querySelector('input[value="codex"]') as HTMLInputElement;
		codex.checked = true;
		codex.dispatchEvent(new Event("change", { bubbles: true }));
		const text = document.body.textContent ?? "";
		expect(text).toContain("codex plugin add ork-codex@orchestkit-codex");
		expect(text).not.toContain("claude plugin install ork@orchestkit");
		const hosts = call.structuredContent.hosts as Array<{ id: string; copy: string }>;
		const btn = document.querySelector("button[data-copy]") as HTMLButtonElement;
		expect(btn.getAttribute("data-copy")).toBe(hosts.find((h) => h.id === "codex")!.copy);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("a repo name is labelled as a repo name, a shell command as a command", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: {} });
		const hosts = call.structuredContent.hosts as Array<{ id: string; copyLabel: string }>;
		expect(hosts.find((h) => h.id === "cursor")!.copyLabel).toBe("Copy repo name");
		// Two lines copy as one && line, and the label says so.
		expect(hosts.find((h) => h.id === "claude")!.copyLabel).toBe("Copy both commands");
		expect(hosts.find((h) => h.id === "codex")!.copyLabel).toBe("Copy both commands");
		mount(await viewHtml(PICKER_URI), { ...call.structuredContent, selected: "cursor" });
		expect(document.querySelector("button[data-copy]")?.textContent).toBe("Copy repo name");
	});

	it("preselects the host the tool was asked for", async () => {
		const call = await rpc("tools/call", { name: "orchestkit_install", arguments: { host: "cursor" } });
		mount(await viewHtml(PICKER_URI), call.structuredContent);
		expect((document.querySelector('input[value="cursor"]') as HTMLInputElement).checked).toBe(true);
		expect(document.body.textContent).toContain("yonatangross/orchestkit");
	});
});
