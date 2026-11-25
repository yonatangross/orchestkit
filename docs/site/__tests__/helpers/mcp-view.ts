// Runs a view's own script against a stand-in window whose parent records what
// it is sent. happy-dom rewrites source and origin on dispatched MessageEvents,
// so the listener is captured and called with the exact fields a browser sets.

export type Sent = {
	message: { method?: string; id?: number; params?: Record<string, unknown>; result?: unknown };
	target: string;
};

export const CLAUDE_PROXY = "https://a904794854a047f6.claudemcpcontent.com";
export const OPENAI_PROXY = "https://www-orchestkit-dev.oaiusercontent.com";

export function viewScript(html: string): string {
	const doc = new DOMParser().parseFromString(html, "text/html");
	return doc.querySelector("script")?.textContent ?? "";
}

/** The painted part of the one view in the document, without its stylesheet. */
export function viewRoot(): { element: HTMLElement; app: HTMLElement } {
	const element = [...document.body.children].find((n) => n.tagName.startsWith("ORK-")) as
		| HTMLElement
		| undefined;
	const app = element?.shadowRoot?.querySelector<HTMLElement>(".app");
	if (!element || !app) throw new Error("the document mounted no view element");
	return { element, app };
}

export function bootView(html: string, extra: Record<string, unknown> = {}) {
	const script = viewScript(html);
	if (!script) throw new Error("the view HTML must embed its script");
	document.body.innerHTML = "";
	const sent: Sent[] = [];
	const parent = {
		postMessage(message: Sent["message"], target: string) {
			sent.push({ message, target });
		},
	};
	const listeners: ((e: unknown) => void)[] = [];
	const frame = {
		parent,
		addEventListener(type: string, fn: (e: unknown) => void) {
			if (type === "message") listeners.push(fn);
		},
		...extra,
	};
	const run = new Function("window", `"use strict";${script}`) as (w: unknown) => void;
	run(frame);
	const { element, app } = viewRoot();
	return {
		element,
		app,
		sent,
		parent,
		deliver(data: unknown, origin: string = CLAUDE_PROXY, source: unknown = parent) {
			for (const fn of listeners) fn({ data, origin, source });
		},
	};
}

export const toolResult = (structuredContent: unknown) => ({
	jsonrpc: "2.0",
	method: "ui/notifications/tool-result",
	params: { structuredContent },
});

export const initResult = (extra: Record<string, unknown> = {}) => ({
	jsonrpc: "2.0",
	id: 1,
	result: { protocolVersion: "2026-01-26", ...extra },
});
