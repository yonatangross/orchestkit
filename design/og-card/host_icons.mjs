// Rasterize the site's own host marks (docs/site/components/host-marks.tsx) to
// PNGs for compose.py. Reads the component source so the card and the site
// never drift. Usage: node design/og-card/host_icons.mjs claude cursor codex muse opencode pi agy devin
import { existsSync, readFileSync, mkdirSync } from "node:fs";
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

function fillPath(host) {
  const m = src.match(new RegExp(`\\n\\t${host}: '([^']+)'`));
  return m && `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${FG}"><path d="${m[1]}"/></svg>`;
}

// Hosts drawn by a custom component: find it via the HostMark dispatch line,
// then turn that component's JSX <svg> into plain SVG.
function componentSvg(host) {
  const disp = src.match(new RegExp(`host === "${host}"\\) return <(\\w+)`));
  if (!disp) return null;
  const body = src.match(new RegExp(`function ${disp[1]}\\b[\\s\\S]*?(<svg[\\s\\S]*?</svg>)`));
  if (!body) return null;
  return body[1]
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

const hosts = process.argv.slice(2);
if (!hosts.length) throw new Error("name at least one host id");
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
