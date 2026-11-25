// "What you get per host": the orchestkit_host_support tool and its view. Every
// fact comes from HOST_SUPPORT and HOST_INSTALLS, the lists the home page and
// llms.txt read, so no host text is typed twice.

import { describe, expect, it, vi } from "vitest";
import { COUNTS, SITE } from "@/lib/constants";
import { HOOKS_LIMIT, HOST_SUPPORT } from "@/lib/host-support";
import { HOST_INSTALLS } from "@/lib/host-installs";
import { bootConnected, bootView, CLAUDE_PROXY, toolResult } from "./helpers/mcp-view";

vi.mock("@/lib/doc-markdown", () => ({ getDocMarkdown: async () => null }));
vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: () => {} }));

const URI = "ui://orchestkit/host-support";
const TOOL = "orchestkit_host_support";

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

type Host = {
	id: string;
	name: string;
	gets: string;
	hooks: boolean;
	commands: string[];
	docsUrl: string;
};

const call = (args: Record<string, unknown> = {}) => rpc("tools/call", { name: TOOL, arguments: args });
const view = async () => (await rpc("resources/read", { uri: URI })).contents[0];

describe("orchestkit_host_support", () => {
	it("is listed read-only and bound to its view", async () => {
		const { tools } = await rpc("tools/list");
		const tool = tools.find((t: { name: string }) => t.name === TOOL);
		expect(tool).toBeDefined();
		expect(tool._meta.ui.resourceUri).toBe(URI);
		expect(tool._meta["openai/outputTemplate"]).toBe(URI);
		expect(tool.annotations.readOnlyHint).toBe(true);
		expect(tool.outputSchema.type).toBe("object");
		const init = await rpc("initialize", { protocolVersion: "2025-06-18" });
		expect(init.instructions).toContain(TOOL);
	});

	it("returns all hosts with the site's own words and commands, Claude Code first", async () => {
		const { structuredContent: d } = await call();
		const hosts = d.hosts as Host[];
		expect(hosts.map((h) => h.id)).toEqual(HOST_SUPPORT.map((h) => h.id));
		for (const [i, host] of hosts.entries()) {
			expect(host.name).toBe(HOST_SUPPORT[i].name);
			expect(host.gets).toBe(HOST_SUPPORT[i].gets);
			expect(host.hooks).toBe(HOST_SUPPORT[i].hooks);
			expect(host.commands).toEqual(HOST_INSTALLS[i].commands);
			expect(host.docsUrl).toBe(`${SITE.domain}${HOST_INSTALLS[i].href}`);
		}
		expect(d.selected).toBe("claude");
		expect(d.hooksLimit).toBe(HOOKS_LIMIT);
		expect(d.counts).toEqual({ skills: COUNTS.skills, agents: COUNTS.agents, hooks: COUNTS.hooks });
	});

	it("preselects the asked host and falls back for an unknown one", async () => {
		expect((await call({ host: "Cursor" })).structuredContent.selected).toBe("cursor");
		const odd = await call({ host: "emacs" });
		expect(odd.isError).toBeUndefined();
		expect(odd.structuredContent.selected).toBe("claude");
	});

	it("says the same in text for a host that draws no view", async () => {
		const r = await call({ host: "cursor" });
		const body: string = r.content[0].text;
		for (const h of HOST_SUPPORT) {
			expect(body).toContain(h.name);
			expect(body).toContain(h.install);
		}
		expect(body).toContain(HOOKS_LIMIT);
		expect(r._meta.ui.resourceUri).toBe(URI);
	});

	it("serves a view that loads nothing and may write the clipboard", async () => {
		const content = await view();
		expect(content.mimeType).toBe("text/html;profile=mcp-app");
		expect(content.text).toContain("connect-src 'none'");
		expect(content.text).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b/);
		expect(content._meta.ui).toEqual({
			csp: { connectDomains: [], resourceDomains: [] },
			prefersBorder: false,
			permissions: { clipboardWrite: {} },
		});
	});
});

describe("host support view", () => {
	async function shown(args: Record<string, unknown> = {}) {
		const { structuredContent } = await call(args);
		// A tool result counts only after the host's ui/initialize answer.
		const booted = bootConnected((await view()).text);
		booted.deliver(toolResult(structuredContent), CLAUDE_PROXY);
		return { ...booted, data: structuredContent };
	}

	it("offers every host as a radio that says in words whether hooks run", async () => {
		const { app } = await shown();
		const radios = [...app.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		expect(radios.map((r) => r.value)).toEqual(HOST_SUPPORT.map((h) => h.id));
		for (const [i, radio] of radios.entries()) {
			const label = app.querySelector(`label[for="${radio.id}"]`);
			expect(label?.textContent).toContain(HOST_SUPPORT[i].hooks ? "hooks run" : "skills, no hooks");
		}
		expect(app.querySelector("fieldset legend")).not.toBeNull();
		expect(app.textContent).toContain(HOOKS_LIMIT);
	});

	it("shows what the picked host gets and copies exactly its displayed commands", async () => {
		const { app } = await shown();
		const codex = app.querySelector<HTMLInputElement>('input[value="codex"]');
		expect(codex).not.toBeNull();
		if (!codex) return;
		codex.checked = true;
		codex.dispatchEvent(new Event("change", { bubbles: true }));
		const spec = HOST_INSTALLS.find((h) => h.id === "codex");
		expect(app.textContent).toContain(`You get ${HOST_SUPPORT.find((h) => h.id === "codex")?.gets}.`);
		expect(app.querySelector("button[data-copy]")?.getAttribute("data-copy")).toBe(spec?.commands.join(" && "));
		expect(app.querySelector('input[value="codex"]')).toBe(codex);
	});

	it("writes wire text as text and links only to the docs site", async () => {
		const booted = bootConnected((await view()).text);
		booted.deliver(
			toolResult({
				selected: "x",
				hooksLimit: "<img src=y>",
				counts: { skills: "many" },
				hosts: [
					{ id: "x", name: "<b>X</b>", gets: "g", hooks: true, commands: ["c"], docsUrl: "https://evil.example/" },
					{ id: 4, name: "bad" },
				],
			}),
		);
		expect(booted.app.querySelector("img, a")).toBeNull();
		expect(booted.app.textContent).toContain("<b>X</b>");
		expect(booted.app.textContent).not.toContain("bad");
		expect(booted.app.textContent).not.toContain("many");
	});

	it("waits in words before data arrives", async () => {
		expect(bootView((await view()).text).app.textContent).toContain("Waiting for host data from the host");
	});
});
