#!/usr/bin/env node
// Writes the two modules an MCP App view is built from:
//   lib/generated/mcp-ui-tokens.ts    from app/global.css, so the views read the
//                                     same colors, radii and shadows as the site
//   lib/generated/mcp-app-sources.ts  from lib/mcp-app (element, components, CSS)
// A view ships as one string with nothing to link, so both travel inside it.
//
//   node scripts/generate-mcp-ui-tokens.mjs           write the modules
//   node scripts/generate-mcp-ui-tokens.mjs --check   fail if one is stale

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Top-level blocks only: a header starts a line and sits inside no other block.
const LIGHT_BLOCKS = [/^@theme \{/gm, /^@theme static \{/gm, /^:root \{/gm];
const DARK_BLOCKS = [/^\.dark \{/gm];
const KEEP = /^--(color-fd-|yy-|radius-|shadow-|duration-|ease-|gradient-trace)/;

/** How many blocks are open at `end`. */
function depthAt(css, end) {
	let depth = 0;
	for (let i = 0; i < end; i++) {
		if (css[i] === "{") depth++;
		else if (css[i] === "}") depth--;
	}
	return depth;
}

/**
 * A block's own declarations. A nested rule (a media or supports condition, a
 * selector) applies only some of the time, so it is dropped with its prelude.
 */
function ownDeclarations(body) {
	let own = "";
	let pending = "";
	let depth = 0;
	for (const char of body) {
		if (char === "{") {
			if (depth++ === 0) pending = "";
		} else if (char === "}") {
			depth--;
		} else if (depth === 0) {
			pending += char;
			if (char === ";") {
				own += pending;
				pending = "";
			}
		}
	}
	// The last declaration of a block may leave its semicolon out.
	return `${own}${pending};`;
}

/** The body of every top-level block that `header` matches, braces balanced. */
function bodies(css, header) {
	const found = [];
	for (const match of css.matchAll(header)) {
		if (depthAt(css, match.index) !== 0) continue;
		const open = css.indexOf("{", match.index);
		let depth = 0;
		for (let i = open; i < css.length; i++) {
			if (css[i] === "{") depth++;
			else if (css[i] === "}" && --depth === 0) {
				found.push(css.slice(open + 1, i));
				break;
			}
		}
	}
	return found;
}

function tokensIn(css, headers) {
	const tokens = {};
	for (const header of headers) {
		const blocks = bodies(css, header);
		if (blocks.length === 0) {
			throw new Error(`global.css has no block matching ${header.source}`);
		}
		for (const body of blocks) {
			for (const [, name, value] of ownDeclarations(body).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
				if (KEEP.test(name)) tokens[name] = value.trim().replace(/\s+/g, " ");
			}
		}
	}
	return Object.fromEntries(Object.entries(tokens).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** `light` is the default scheme, `dark` holds only what `.dark` overrides. */
export function parseTokens(source) {
	const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
	return { light: tokensIn(css, LIGHT_BLOCKS), dark: tokensIn(css, DARK_BLOCKS) };
}

export function renderTokensModule(source) {
	const { light, dark } = parseTokens(source);
	const block = (name, tokens) =>
		`export const ${name}: Readonly<Record<string, string>> = ${JSON.stringify(tokens, null, "\t")};\n`;
	return [
		"// GENERATED from app/global.css by scripts/generate-mcp-ui-tokens.mjs.",
		"// Do not edit. Run `npm run gen:mcp-ui-tokens` after a token changes.",
		"",
		block("MCP_UI_LIGHT_TOKENS", light),
		block("MCP_UI_DARK_TOKENS", dark),
	].join("\n");
}

/** The files of lib/mcp-app as strings: a view is served as one document. */
export function renderSourcesModule(site) {
	const read = (rel) => {
		const source = readFileSync(resolve(site, "lib/mcp-app", rel), "utf8");
		if (/<\/script/i.test(source)) throw new Error(`lib/mcp-app/${rel} would close its script element`);
		return source;
	};
	const tags = readdirSync(resolve(site, "lib/mcp-app/components"))
		.filter((file) => file.endsWith(".js"))
		.map((file) => file.slice(0, -3))
		.sort();
	const css = read("views.css").replace(/\/\*[\s\S]*?\*\//g, "").trim();
	return [
		"// GENERATED from lib/mcp-app by scripts/generate-mcp-ui-tokens.mjs.",
		"// Do not edit. Run `npm run gen:mcp-ui-tokens` after a view source changes.",
		"",
		`export type McpViewTag = ${tags.map((tag) => JSON.stringify(tag)).join(" | ")};`,
		"",
		"export const MCP_APP_SOURCES: Readonly<{",
		"\tbase: string;",
		"\tcss: string;",
		"\tcomponents: Readonly<Record<McpViewTag, string>>;",
		"}> = {",
		`\tbase: ${JSON.stringify(read("base.js"))},`,
		`\tcss: ${JSON.stringify(css)},`,
		"\tcomponents: {",
		...tags.map((tag) => `\t\t${JSON.stringify(tag)}: ${JSON.stringify(read(`components/${tag}.js`))},`),
		"\t},",
		"};",
		"",
	].join("\n");
}

function main(args) {
	const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const modules = {
		"lib/generated/mcp-ui-tokens.ts": renderTokensModule(readFileSync(resolve(site, "app/global.css"), "utf8")),
		"lib/generated/mcp-app-sources.ts": renderSourcesModule(site),
	};
	let stale = 0;
	for (const [rel, next] of Object.entries(modules)) {
		const out = resolve(site, rel);
		if (!args.includes("--check")) {
			writeFileSync(out, next);
			console.log(`[mcp-ui] wrote ${rel}`);
			continue;
		}
		let current = "";
		try {
			current = readFileSync(out, "utf8");
		} catch {
			// A missing module is stale like any other.
		}
		if (current === next) continue;
		console.error(`[mcp-ui] ${rel} is stale. Run \`npm run gen:mcp-ui-tokens\` and commit it.`);
		stale = 1;
	}
	return stale;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
