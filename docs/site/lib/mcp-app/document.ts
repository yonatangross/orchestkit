// One MCP App view as a document: the site tokens, the shared stylesheet, the
// base element and one component, inlined. The view ships as a JSON-RPC string
// (resources/read), so it can link nothing and its CSP travels in a meta tag.

import { MCP_APP_SOURCES, type McpViewTag } from "@/lib/generated/mcp-app-sources";
import { MCP_UI_DARK_TOKENS, MCP_UI_LIGHT_TOKENS } from "@/lib/generated/mcp-ui-tokens";

const declare = (tokens: Readonly<Record<string, string>>) =>
	Object.entries(tokens)
		.map(([name, value]) => `${name}:${value};`)
		.join("");

const DARK = `${declare(MCP_UI_DARK_TOKENS)}color-scheme:dark`;
// Until the host names its theme, follow the system setting.
const TOKEN_CSS = [
	`:host{${declare(MCP_UI_LIGHT_TOKENS)}}`,
	`@media (prefers-color-scheme:dark){:host(:not([data-theme="light"])){${DARK}}}`,
	`:host([data-theme="dark"]){${DARK}}`,
].join("");

// A string literal that cannot close the script element it sits in.
const literal = (value: string) => JSON.stringify(value).replace(/</g, "\\u003c");

export function appDocument(view: { tag: McpViewTag; title: string; csp: string }): string {
	const script = [
		MCP_APP_SOURCES.base,
		`window.OrkMcp.styles(${literal(TOKEN_CSS + MCP_APP_SOURCES.css)});`,
		MCP_APP_SOURCES.components[view.tag],
		`window.OrkMcp.mount(${literal(view.tag)});`,
	].join("\n");
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="${view.csp}" />
<meta name="color-scheme" content="light dark" />
<title>${view.title}</title>
<style>html,body{margin:0;background:transparent}</style></head>
<body><script>${script}</script></body></html>`;
}
