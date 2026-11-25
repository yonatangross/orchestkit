// The MCP App views read the site's own tokens: one block generated from
// app/global.css, never typed. These tests pin the generator, the committed
// output, and the contrast of the pairs a view (and the site) puts text on.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MCP_UI_DARK_TOKENS, MCP_UI_LIGHT_TOKENS } from "@/lib/generated/mcp-ui-tokens";
import { parseTokens, renderTokensModule } from "../scripts/generate-mcp-ui-tokens.mjs";

const SITE_DIR = resolve(__dirname, "..");
const read = (rel: string) => readFileSync(resolve(SITE_DIR, rel), "utf8");
const css = read("app/global.css");

const light: Record<string, string> = { ...MCP_UI_LIGHT_TOKENS };
const dark: Record<string, string> = { ...MCP_UI_LIGHT_TOKENS, ...MCP_UI_DARK_TOKENS };

type Rgb = [number, number, number];

/** `oklch(L C H)` or `oklch(L C H / a)` to linear sRGB plus alpha. */
function oklch(value: string): { rgb: Rgb; alpha: number } {
	const m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(value);
	if (!m) throw new Error(`not an oklch color: ${value}`);
	const L = Number(m[1]) / (m[2] ? 100 : 1);
	const C = Number(m[3]);
	const h = (Number(m[4]) * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	const clamp = (c: number) => Math.min(1, Math.max(0, c));
	return {
		rgb: [
			clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s),
			clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s),
			clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s),
		],
		alpha: m[5] === undefined ? 1 : Number(m[5]),
	};
}

const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** A translucent color painted over an opaque one, blended in sRGB as browsers do. */
function over(top: string, bottom: string): Rgb {
	const t = oklch(top);
	const u = oklch(bottom);
	return t.rgb.map((c, i) => decode(encode(c) * t.alpha + encode(u.rgb[i]) * (1 - t.alpha))) as Rgb;
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function contrast(a: Rgb, b: Rgb): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe("token generator", () => {
	it("the committed module is what the generator makes from global.css today", () => {
		expect(read("lib/generated/mcp-ui-tokens.ts")).toBe(renderTokensModule(css));
	});

	it("reads both schemes and keeps only the tokens a view can use", () => {
		const { light: l, dark: d } = parseTokens(css);
		expect(l["--color-fd-primary"]).toBe("oklch(0.488 0.217 264)");
		expect(d["--color-fd-primary"]).toBe("oklch(0.62 0.2 264)");
		expect(l["--radius-card"]).toBeDefined();
		expect(l["--gradient-trace"]).toContain("linear-gradient");
		expect(Object.keys(l).filter((k) => /^--(text-fluid|section)-/.test(k))).toEqual([]);
		expect(Object.keys(d).filter((k) => !(k in l))).toEqual([]);
	});

	it("fails loudly when global.css no longer has a block it reads", () => {
		expect(() => parseTokens(".nothing { --color-fd-primary: red; }")).toThrow(/block/);
	});

	// The smallest stylesheet that has every block the generator reads.
	const sheet = (root: string, after = "") =>
		[
			"@theme {\n  --color-fd-primary: blue;\n}",
			"@theme static {\n  --color-fd-info: teal;\n}",
			`:root {\n${root}\n}`,
			".dark {\n  --color-fd-primary: navy;\n}",
			after,
		].join("\n");

	it("never reads a declaration nested in a condition as an unconditional token", () => {
		const { light: l, dark: d } = parseTokens(
			sheet(
				[
					"  --radius-card: 14px;",
					"  @media print { --radius-card: 0; --shadow-card: none; }",
					"  @supports (--radius-base: 1px) { --radius-base: 2px; }",
					"  --radius-control: 8px",
				].join("\n"),
			),
		);
		expect(l["--radius-card"]).toBe("14px");
		expect(l["--shadow-card"]).toBeUndefined();
		expect(l["--radius-base"]).toBeUndefined();
		// A last declaration without a semicolon is still a declaration.
		expect(l["--radius-control"]).toBe("8px");
		expect(d["--color-fd-primary"]).toBe("navy");
	});

	it("skips a block that sits inside another rule, however it is indented", () => {
		const { light: l, dark: d } = parseTokens(
			sheet(
				"  --radius-card: 14px;",
				"@media print {\n:root {\n  --radius-card: 0;\n}\n.dark {\n  --color-fd-primary: black;\n}\n}",
			),
		);
		expect(l["--radius-card"]).toBe("14px");
		expect(d["--color-fd-primary"]).toBe("navy");
	});

	it("the build checks the committed module against global.css", () => {
		const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
		expect(pkg.scripts.prebuild).toContain("generate-mcp-ui-tokens.mjs --check");
	});
});

describe.each([
	["light", light],
	["dark", dark],
])("contrast, %s", (_scheme, tokens) => {
	const color = (name: string) => {
		const value = tokens[name];
		expect(value, name).toBeDefined();
		return value;
	};

	it("a button label on a solid primary fill is at least 4.5:1", () => {
		const ratio = contrast(
			oklch(color("--color-fd-primary-foreground")).rgb,
			oklch(color("--color-fd-primary-solid")).rgb,
		);
		expect(ratio).toBeGreaterThanOrEqual(4.5);
	});

	it("the solid fill stands out from the page at 3:1 or more", () => {
		const ratio = contrast(
			oklch(color("--color-fd-primary-solid")).rgb,
			oklch(color("--color-fd-background")).rgb,
		);
		expect(ratio).toBeGreaterThanOrEqual(3);
	});

	it.each(["--color-fd-background", "--color-fd-card", "--color-fd-surface-raised"])(
		"accent text on %s, plain and under the 10%% tint, is at least 4.5:1",
		(surface) => {
			const text = oklch(color("--color-fd-primary-text")).rgb;
			expect(contrast(text, oklch(color(surface)).rgb)).toBeGreaterThanOrEqual(4.5);
			expect(
				contrast(text, over(color("--color-fd-primary-10"), color(surface))),
			).toBeGreaterThanOrEqual(4.5);
		},
	);
});

describe("the site uses the solid step where a label sits on primary", () => {
	it("dark bg-fd-primary fills resolve to the solid token", () => {
		expect(css).toMatch(
			/\.dark \.bg-fd-primary,\s*\.dark \.focus\\:bg-fd-primary:focus\s*\{\s*--color-fd-primary: var\(--color-fd-primary-solid\);/,
		);
	});

	it("the inline-styled Lab badge fills with the solid token", () => {
		expect(read("components/lab-gallery.tsx")).toContain(
			'background: "var(--color-fd-primary-solid)", color: "var(--color-fd-primary-foreground)"',
		);
	});
});
