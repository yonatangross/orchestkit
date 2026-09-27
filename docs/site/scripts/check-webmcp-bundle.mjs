#!/usr/bin/env node
// Post-build guard: the built client chunks must carry a literal
// `document.modelContext.registerTool(` call.
//
// Why: orank's WebMCP check scans same-origin JS bundles for
// document.modelContext registrations. The #4107 helper took the document as a
// parameter, so the minified layout chunk read `i=e.modelContext` and the
// 2026-09-27 scan saw only the declarative form. A unit test can pin the
// source text, but only the built chunk proves what minification kept.
//
// Scope: the ROOT LAYOUT chunk (.next/static/chunks/app/layout-*.js), which
// every page's HTML loads and which is where WebMcpProvider mounts. A
// whole-tree grep is not enough: a lazy data chunk carries the same string
// as PROSE (a lab or changelog entry quoting "document.modelContext.registerTool()"),
// so it matched on the #4107 control build too. Measured 2026-09-28: control
// build, layout chunk 0 literals (`i=e.modelContext`), lazy chunk 1583 still 1.
//
// Usage (after `next build`, from docs/site): node scripts/check-webmcp-bundle.mjs
// Exit 0 when the layout chunk holds the call, 1 when it does not, 2 when
// there is no build to check.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const CHUNKS = join(process.cwd(), ".next", "static", "chunks");
const CALL = "document.modelContext.registerTool(";
const GETTER = "document.modelContext";

if (!existsSync(CHUNKS)) {
	console.error(`check-webmcp-bundle: ${CHUNKS} not found; run next build first.`);
	process.exit(2);
}

function* jsFiles(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* jsFiles(path);
		else if (name.endsWith(".js")) yield path;
	}
}

const count = (text, needle) => text.split(needle).length - 1;

const isLayout = (file) => /[\\/]app[\\/]layout-[^\\/]*\.js$/.test(file);

let layoutFiles = 0;
let layoutCalls = 0;
for (const file of jsFiles(CHUNKS)) {
	const text = readFileSync(file, "utf8");
	const getters = count(text, GETTER);
	const calls = count(text, CALL);
	const layout = isLayout(file);
	if (layout) {
		layoutFiles += 1;
		layoutCalls += calls;
	}
	if (getters > 0 || layout) {
		const tag = layout ? "root layout" : "other chunk, informational";
		console.log(`  ${relative(process.cwd(), file)}: ${calls} call, ${getters} getter (${tag})`);
	}
}

if (layoutFiles === 0) {
	console.error("check-webmcp-bundle: no app/layout-*.js chunk found; is this a Next app-router build?");
	process.exit(2);
}
console.log(`check-webmcp-bundle: root layout "${CALL}" x${layoutCalls}`);

if (layoutCalls === 0) {
	console.error(
		`check-webmcp-bundle: FAIL, the root layout chunk has no "${CALL}". ` +
			"orank's WebMCP scan cannot see the imperative registration. Keep the " +
			"call on the document global in lib/webmcp-tools.ts (registerOnDocument).",
	);
	process.exit(1);
}
console.log("check-webmcp-bundle: OK");
