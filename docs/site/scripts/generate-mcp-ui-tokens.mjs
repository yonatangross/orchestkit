#!/usr/bin/env node
// Writes lib/generated/mcp-ui-tokens.ts from app/global.css, so the MCP App
// views read the same colors, radii, shadows and durations as the site. A view
// ships as one string with no stylesheet to link, so the tokens travel inside it.
//
//   node scripts/generate-mcp-ui-tokens.mjs           write the module
//   node scripts/generate-mcp-ui-tokens.mjs --check   fail if it is stale

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Top-level blocks only: the header starts a line, so nested rules are skipped.
const LIGHT_BLOCKS = [/^@theme \{/gm, /^@theme static \{/gm, /^:root \{/gm];
const DARK_BLOCKS = [/^\.dark \{/gm];
const KEEP = /^--(color-fd-|yy-|radius-|shadow-|duration-|ease-|gradient-trace)/;

/** The body of every top-level block that `header` matches, braces balanced. */
function bodies(css, header) {
	const found = [];
	for (const match of css.matchAll(header)) {
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
			for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
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

function main(args) {
	const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
	const out = resolve(site, "lib/generated/mcp-ui-tokens.ts");
	const next = renderTokensModule(readFileSync(resolve(site, "app/global.css"), "utf8"));
	if (!args.includes("--check")) {
		writeFileSync(out, next);
		console.log(`[mcp-ui-tokens] wrote ${out}`);
		return 0;
	}
	let current = "";
	try {
		current = readFileSync(out, "utf8");
	} catch {
		// A missing module is stale like any other.
	}
	if (current === next) return 0;
	console.error(
		"[mcp-ui-tokens] lib/generated/mcp-ui-tokens.ts is stale. Run `npm run gen:mcp-ui-tokens` and commit it.",
	);
	return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = main(process.argv.slice(2));
}
