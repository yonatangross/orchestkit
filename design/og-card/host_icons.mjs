// Rasterize the site's own host marks (docs/site/components/host-marks.tsx) to
// PNGs for compose.py. Reads the component source so the card and the site
// never drift. Usage: node design/og-card/host_icons.mjs claude cursor codex muse opencode pi agy devin
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
// sharp ships with the docs site; fall back to the primary checkout when this
// worktree has no node_modules of its own.
const candidates = [
  join(root, "docs/site/package.json"),
  join(root, "../../docs/site/package.json"),
];
let sharp;
const misses = [];
for (const c of candidates) {
  try {
    sharp = createRequire(c)("sharp");
    break;
  } catch (err) {
    misses.push(`${c}: ${err.code ?? err.message}`);
  }
}
if (!sharp) throw new Error(`sharp not found; run npm install in docs/site\n${misses.join("\n")}`);

const src = readFileSync(join(root, "docs/site/components/host-marks.tsx"), "utf8");
const FG = "#e5e8f0";
const SIZE = 128;

// The file is parsed once into plain maps, so no pattern is ever built from a
// host name (a RegExp from argv is a regex-injection sink; CodeQL js/regex-injection).
const FILL_PATHS = new Map(
  [...src.matchAll(/\n\t(\w+): '([^']+)'/g)].map(([, host, d]) => [host, d]),
);
const COMPONENT_FOR_HOST = new Map(
  [...src.matchAll(/host === "(\w+)"\) return <(\w+)/g)].map(([, host, name]) => [host, name]),
);
const COMPONENT_SVG = new Map(
  [...src.matchAll(/function (\w+)\(\{ className \}[\s\S]*?(<svg[\s\S]*?<\/svg>)/g)].map(
    ([, name, svg]) => [name, svg],
  ),
);

function fillPath(host) {
  const d = FILL_PATHS.get(host);
  return d && `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${FG}"><path d="${d}"/></svg>`;
}

// Hosts the site draws with a custom component: follow the HostMark dispatch to
// the component, then turn its JSX <svg> into plain SVG.
function componentSvg(host) {
  const name = COMPONENT_FOR_HOST.get(host);
  const svg = name && COMPONENT_SVG.get(name);
  if (!svg) return null;
  return svg
    .replace(/\s*className=\{className\}/, "")
    .replace(/\s*aria-hidden="true"/, "")
    .replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"')
    .replace(/stroke(Width|Linecap|Linejoin)=/g, (_, k) => `stroke-${k.toLowerCase()}=`)
    .replaceAll("currentColor", FG);
}

// Real marks vendored under marks/ (see marks/SOURCES.md) win over the site's
// generic glyphs for the same host.
function vendoredSvg(host) {
  const f = join(here, "marks", `${host}.svg`);
  if (!existsSync(f)) return null;
  let svg = readFileSync(f, "utf8").replaceAll("currentColor", FG);
  if (!/<svg[^>]*\sfill=/.test(svg)) svg = svg.replace("<svg", `<svg fill="${FG}"`);
  return svg;
}

// Allowlist of host keys, derived from the three real sources of marks. argv is
// checked against it before it reaches a file path or a lookup, so an unknown or
// crafted argument fails loudly instead of being interpolated anywhere.
const KNOWN_HOSTS = new Set([
  ...FILL_PATHS.keys(),
  ...COMPONENT_FOR_HOST.keys(),
  ...readdirSync(join(here, "marks"))
    .filter((f) => f.endsWith(".svg"))
    .map((f) => f.slice(0, -4)),
]);

const hosts = process.argv.slice(2);
if (!hosts.length) throw new Error("name at least one host id");
const unknown = hosts.filter((h) => !KNOWN_HOSTS.has(h));
if (unknown.length) {
  throw new Error(
    `unknown host id(s): ${unknown.join(", ")}\nknown: ${[...KNOWN_HOSTS].sort().join(", ")}`,
  );
}
const out = join(here, "icons");
mkdirSync(out, { recursive: true });
for (const h of hosts) {
  const svg = vendoredSvg(h) ?? fillPath(h) ?? componentSvg(h);
  if (!svg) throw new Error(`no mark for host "${h}" in host-marks.tsx`);
  await sharp(Buffer.from(svg), { density: 72 * (SIZE / 24) })
    .resize(SIZE, SIZE)
    .png()
    .toFile(join(out, `${h}.png`));
  console.log(join("icons", `${h}.png`));
}
