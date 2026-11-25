// MCP App views for the docs MCP: the skill card and the install picker. The
// markup is the shared view element (lib/mcp-app). These two need no data after
// they load, so their policy is stricter than the search view's:
//   - connect-src 'none': the frame makes no network call. The host hands the
//     view its data; picking a host and copying a command happen in the frame.
//   - no external script, no font, no image: one inline script, inline style.
//   - text is written as text, never as markup.
// The CSP travels inside the document (<meta http-equiv>) because the view ships
// as a JSON-RPC string, not an HTTP response (see lib/mcp-ui.ts).

import { appDocument } from "@/lib/mcp-app/document";

export const UI_SKILL_CARD = "ui://orchestkit/skill-card";
export const UI_INSTALL_PICKER = "ui://orchestkit/install-picker";

export const CARD_CSP = [
	"default-src 'none'",
	"script-src 'unsafe-inline'",
	"style-src 'unsafe-inline'",
	"img-src data:",
	"connect-src 'none'",
	"frame-ancestors https://chatgpt.com https://claude.ai",
	"form-action 'none'",
	"base-uri 'none'",
].join("; ");

export const SKILL_CARD_HTML = appDocument({
	tag: "ork-skill-card",
	title: "OrchestKit skill card",
	csp: CARD_CSP,
});

export const INSTALL_PICKER_HTML = appDocument({
	tag: "ork-install-picker",
	title: "OrchestKit install picker",
	csp: CARD_CSP,
});

export const UI_HOST_SUPPORT = "ui://orchestkit/host-support";

export const HOST_SUPPORT_HTML = appDocument({
	tag: "ork-host-support",
	title: "OrchestKit on your host",
	csp: CARD_CSP,
});
