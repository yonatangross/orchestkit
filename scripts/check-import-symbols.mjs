#!/usr/bin/env node
// scripts/check-import-symbols.mjs — assert every symbol a skill imports actually exists.
//
// WHY THIS EXISTS
//
//   `import { LangfuseExporter } from "@langfuse/otel"` shipped in four skill files. The package
//   has never exported that symbol at ANY version, so every copy-paste threw at import. It passed
//   lint, structure tests, floor agreement, and the upstream-drift linter, because all of those
//   check VERSIONS. No version comparison can catch a symbol that was never published.
//
//   Separately, `@langfuse/vercel` was documented as a migration target for months and has never
//   been published at all.
//
//   This gate closes both: resolve each package's published type declarations and check that every
//   named import appears in its export list.
//
// WHY IT IS NIGHTLY, NOT A PR GATE
//
//   It needs the network. A PR gate that depends on registry.npmjs.org goes red when npm has a bad
//   afternoon, and gates that flake get ignored. Run it on a schedule; keep PR gates offline.
//
// CONTAINMENT — this repo has already rejected one lexical scanner for crying wolf, so the scope
// is deliberately narrow, and everything skipped is COUNTED and PRINTED. A gate that silently
// drops what it cannot handle reports "all clear" for work it never did.
//
//   checked : bare `import { A, B } from "pkg"` in ts/typescript fences, for packages in
//             LIBRARY_REGISTRY, resolved to a .d.ts with an unambiguous export list
//   skipped : relative paths, node builtins, subpath imports (`pkg/sub` needs per-package export
//             maps), unmapped packages, packages whose .d.ts uses `export *` (the export list is
//             not self-contained, so an absence proves nothing)
//
// Usage:
//   node scripts/check-import-symbols.mjs            # report, exit 0
//   node scripts/check-import-symbols.mjs --check    # exit 1 on any missing symbol
//   node scripts/check-import-symbols.mjs --dir <p>  # scan a different tree (used to self-prove)

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveLibrary } from './lib/registry-resolve.mjs';
import {
  tsFences,
  namedImports,
  splitSpecifier,
  parseExports,
  typePaths,
} from './lib/import-symbols.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const argv = process.argv.slice(2);
const wantCheck = argv.includes('--check');
const dirFlag = argv.indexOf('--dir');
const SCAN_DIR = dirFlag !== -1 && argv[dirFlag + 1] ? argv[dirFlag + 1] : join(ROOT, 'src', 'skills');

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const CDN = 'https://cdn.jsdelivr.net/npm';

async function getJson(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function getText(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  }
}

const pkgCache = new Map();
async function packageExports(root) {
  if (pkgCache.has(root)) return pkgCache.get(root);
  let result = { status: 'unresolved', names: new Set(), selfContained: false };
  const manifest = await getJson(`https://registry.npmjs.org/${root}/latest`);
  if (!manifest) {
    result = { status: 'not-published', names: new Set(), selfContained: false };
  } else {
    const version = manifest.version;
    for (const p of typePaths(manifest)) {
      const dts = await getText(`${CDN}/${root}@${version}/${p}`);
      if (dts) {
        const parsed = parseExports(dts);
        result = { status: 'ok', version, path: p, ...parsed };
        break;
      }
    }
    if (result.status !== 'ok') result = { status: 'no-types', version, names: new Set(), selfContained: false };
  }
  pkgCache.set(root, result);
  return result;
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

const files = walk(SCAN_DIR);
const sites = [];
for (const f of files) {
  const md = readFileSync(f, 'utf8');
  for (const fence of tsFences(md)) {
    for (const imp of namedImports(fence)) sites.push({ file: f, ...imp });
  }
}

const missing = [];
const phantomPkgs = [];
const skipped = { relative: 0, builtin: 0, subpath: 0, unmapped: 0, noTypes: 0, starExport: 0 };
let checkedSymbols = 0;

for (const site of sites) {
  const parsed = splitSpecifier(site.spec);
  if (parsed.kind === 'relative') { skipped.relative++; continue; }
  if (parsed.kind === 'builtin') { skipped.builtin++; continue; }
  if (parsed.subpath) { skipped.subpath++; continue; }
  if (!resolveLibrary(parsed.root)) { skipped.unmapped++; continue; }

  const info = await packageExports(parsed.root);
  if (info.status === 'not-published') {
    phantomPkgs.push({ file: site.file, pkg: parsed.root });
    continue;
  }
  if (info.status !== 'ok') { skipped.noTypes++; continue; }
  if (!info.selfContained) { skipped.starExport++; continue; }

  for (const sym of site.symbols) {
    checkedSymbols++;
    if (!info.names.has(sym)) {
      missing.push({ file: site.file, pkg: parsed.root, symbol: sym, version: info.version });
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const rel = (p) => p.replace(`${ROOT}/`, '');

console.log('==========================================');
console.log('  import-symbol gate');
console.log('==========================================\n');
console.log(`  scanned files        : ${files.length}`);
console.log(`  named-import sites   : ${sites.length}`);
console.log(`  symbols verified     : ${checkedSymbols}`);
console.log(`  packages resolved    : ${[...pkgCache.values()].filter((v) => v.status === 'ok').length}`);
console.log('');
console.log('  skipped (NOT verified — this gate did not look at these):');
console.log(`    relative imports   : ${skipped.relative}`);
console.log(`    node builtins      : ${skipped.builtin}`);
console.log(`    subpath imports    : ${skipped.subpath}   (pkg/sub needs per-package export maps)`);
console.log(`    unmapped packages  : ${skipped.unmapped}   (add to LIBRARY_REGISTRY to cover)`);
console.log(`    no type decls      : ${skipped.noTypes}`);
console.log(`    "export *" packages: ${skipped.starExport}   (export list not self-contained)`);

if (phantomPkgs.length > 0) {
  console.log(`\n  PACKAGES THAT DO NOT EXIST (${phantomPkgs.length}):`);
  for (const p of phantomPkgs) console.log(`    ${rel(p.file)}  ->  ${p.pkg}`);
}

if (missing.length > 0) {
  console.log(`\n  SYMBOLS NOT EXPORTED (${missing.length}):`);
  for (const m of missing) {
    console.log(`    ${rel(m.file)}`);
    console.log(`      import { ${m.symbol} } from "${m.pkg}"   — absent from ${m.pkg}@${m.version}`);
  }
}

const failures = missing.length + phantomPkgs.length;
if (failures === 0) {
  console.log('\nEvery verified import resolves to a published symbol.');
  process.exit(0);
}

console.log(`\n${failures} broken import(s).`);
process.exit(wantCheck ? 1 : 0);
