#!/usr/bin/env node
// Post-build guard: the served HTML for "/" must carry the WebMCP registration
// in an INLINE script (a <script> with no src), with the literal
// `document.modelContext.registerTool(` in its body.
//
// Why: ora.ai scored the site webmcp 1/5 while the app/layout-*.js chunk held
// the literal (check-webmcp-bundle.mjs proves that part). ora.ai's own page
// registers its tools inline, so the hypothesis is that the scanner reads only
// the HTML. This check pins the inline half so a refactor cannot drop it.
//
// What does NOT count: Next's RSC flight payload. The layout's
// dangerouslySetInnerHTML string is also serialized into
// `self.__next_f.push([...])` inline scripts, so the literal appears there
// even though that text never runs as a registration. Those scripts are
// skipped; only a script whose own body is the registration counts.
//
// Usage (after `next build`, from docs/site):
//   node scripts/check-webmcp-inline-html.mjs [path/to/index.html]
// Exit 0 when an inline script holds the call, 1 when none does, 2 when there
// is no built HTML to check.

import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const CALL = "document.modelContext.registerTool(";
const file = process.argv[2] ?? join(process.cwd(), ".next", "server", "app", "index.html");

if (!existsSync(file)) {
	console.error(`check-webmcp-inline-html: ${file} not found; run next build first.`);
	process.exit(2);
}

const html = readFileSync(file, "utf8");
// The end tag may carry whitespace or junk before ">" (`</script >`); HTML still closes on it.
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi;
const isFlight = (body) => /^\s*\(?\s*self\.__next_f\b/.test(body);

let inlineScripts = 0;
let flightScripts = 0;
let registering = 0;
let flightMentions = 0;
for (const [, attrs, body] of html.matchAll(SCRIPT)) {
	if (/\bsrc\s*=/i.test(attrs)) continue;
	if (isFlight(body)) {
		flightScripts += 1;
		if (body.includes(CALL)) flightMentions += 1;
		continue;
	}
	inlineScripts += 1;
	if (body.includes(CALL)) {
		registering += 1;
		const id = /\bid\s*=\s*"([^"]*)"/i.exec(attrs)?.[1] ?? "(no id)";
		console.log(`  inline script ${id}: ${body.split(CALL).length - 1} call(s), ${body.length} bytes`);
	}
}

console.log(
	`check-webmcp-inline-html: ${relative(process.cwd(), file)}: ${inlineScripts} inline script(s), ` +
		`${registering} with "${CALL}"; ${flightScripts} flight script(s) skipped (${flightMentions} mention it)`,
);

if (registering === 0) {
	console.error(
		`check-webmcp-inline-html: FAIL, no inline <script> in the served HTML for "/" carries "${CALL}". ` +
			"Keep <WebMcpInlineScript /> in app/layout.tsx (lib/webmcp-inline-script.ts).",
	);
	process.exit(1);
}
console.log("check-webmcp-inline-html: OK");
