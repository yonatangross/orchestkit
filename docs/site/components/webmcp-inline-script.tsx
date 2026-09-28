import { WEBMCP_INLINE_SCRIPT } from "@/lib/webmcp-inline-script";

// Server component: renders the self-contained WebMCP registration as an
// inline <script> in the served HTML (see lib/webmcp-inline-script.ts for
// why). It sits after the page content in the root layout, so a declarative
// <form toolname> on the page is already parsed when it runs and gets skipped.
//
// CSP: next.config.mjs sets `script-src 'self' 'unsafe-inline'` with no nonce
// and no hash, so an inline script is already allowed. Adding a nonce or hash
// here would be wrong: either one makes browsers ignore 'unsafe-inline', which
// would block the other inline scripts the site already relies on.
export function WebMcpInlineScript() {
	return (
		<script
			id="webmcp-inline"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: build-time constant, no user input; JSON data is <-escaped in scriptJson()
			dangerouslySetInnerHTML={{ __html: WEBMCP_INLINE_SCRIPT }}
		/>
	);
}
