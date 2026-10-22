// Every Lab playground must render: a <style> or <script> with no closing tag
// turns the rest of the document into raw text, and the page shows nothing.
// That shipped once (#4823, Codex XREVIEW P2: the GA playground lost its
// </style> and rendered blank), so the whole Lab is checked here.
//
// The rule follows the HTML parser for raw-text elements: after an opening
// <style> or <script>, everything up to the next </style or </script is
// content, even a literal "<script>" inside a JavaScript string.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "../../..");
const MANIFEST = resolve(__dirname, "../lab-manifest");

type Page = { slug: string; source: string; html: string };

function pages(): Page[] {
	const out: Page[] = [];
	for (const file of readdirSync(MANIFEST).filter((f) => f.endsWith(".json")).sort()) {
		const { slug, source } = JSON.parse(readFileSync(join(MANIFEST, file), "utf8")) as {
			slug: string;
			source: string;
		};
		let html: string;
		try {
			html = readFileSync(join(REPO, source), "utf8");
		} catch {
			continue; // pruned or gitignored sources are served from their committed copy
		}
		out.push({ slug, source, html });
	}
	return out;
}

/** Raw-text elements that never close, and the document with them removed. */
export function scanRawText(html: string): { unclosed: string[]; visible: string } {
	const unclosed: string[] = [];
	const lower = html.toLowerCase();
	let visible = "";
	let i = 0;
	const opener = /<(style|script)\b[^>]*>/gi;
	while (i < html.length) {
		opener.lastIndex = i;
		const m = opener.exec(html);
		if (!m) {
			visible += html.slice(i);
			break;
		}
		visible += html.slice(i, m.index);
		const tag = m[1].toLowerCase();
		const end = lower.indexOf(`</${tag}`, m.index + m[0].length);
		if (end === -1) {
			unclosed.push(tag);
			break; // the rest of the document is raw text
		}
		const close = html.indexOf(">", end);
		i = close === -1 ? html.length : close + 1;
	}
	return { unclosed, visible: visible.replace(/<[^>]+>/g, " ") };
}

const ALL = pages();

describe("Lab playgrounds parse and render", () => {
	it("found the Lab sources", () => {
		expect(ALL.length).toBeGreaterThan(100);
	});

	it.each(ALL.map((p) => [p.slug, p] as const))("%s closes every <style> and <script>", (_slug, page) => {
		expect(scanRawText(page.html).unclosed, page.source).toEqual([]);
	});

	it.each(ALL.map((p) => [p.slug, p] as const))("%s has visible text", (_slug, page) => {
		const words = scanRawText(page.html).visible.match(/[A-Za-z]{3,}/g) ?? [];
		expect(words.length, page.source).toBeGreaterThanOrEqual(20);
	});

	it("the scanner treats a literal <script> inside a script as content", () => {
		const html = "<p>one two three</p><script>const s = '<script>' + x;</script><p>after</p>";
		expect(scanRawText(html).unclosed).toEqual([]);
		expect(scanRawText(html).visible).toContain("after");
	});

	it("the scanner catches a missing </style>", () => {
		const html = "<style>body { color: red; }\n<body><h1>Title</h1></body>";
		expect(scanRawText(html).unclosed).toEqual(["style"]);
	});
});
