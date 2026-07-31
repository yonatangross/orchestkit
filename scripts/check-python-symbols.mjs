#!/usr/bin/env node
// scripts/check-python-symbols.mjs — the Python half of the phantom-symbol gate.
//
// WHY THIS EXISTS
// `scripts/check-import-symbols.mjs` verifies that every named JS/TS import resolves to a real
// published export. It has caught real phantoms: `LangfuseExporter` (never published at any version
// of @langfuse/otel) and `JsonRenderComposition` (absent from @json-render/remotion@0.19.0).
//
// It is npm-ONLY. It reads `.d.ts` files, so it has never looked at a single line of Python, and
// this repo ships Python in `mcp-patterns` (145 vendor mentions), `python-backend`, `langgraph`,
// `testing-llm` and others.
//
// That blind spot is not theoretical. Measured 2026-07-31:
//     mcp 1.28.0  ->  19 files under mcp/server/fastmcp/
//     mcp 2.0.0   ->   0 files
// `from mcp.server.fastmcp import FastMCP` appears in 4+ rule files and is a hard ImportError on
// the 2.x that `pip install mcp` now resolves to. No version gate catches that: a floor is
// satisfied by any newer release, and prose scanning cannot tell a requirement from a citation.
// Only reading the published artifact catches it.
//
// HOW IT VERIFIES
// Python publishes no type-declaration file, so there is no export list to read. A wheel is a ZIP,
// so the artifact itself is the source of truth:
//   1. resolve the package version the skill's declared floor actually permits (an upper bound
//      like `<2.0.0` means the newest 1.x, NOT `latest` — testing v1 content against v2 would
//      report failures the skill never claimed to support)
//   2. `unzip -l` the wheel to confirm the MODULE PATH exists
//   3. `unzip -p` that module and confirm the SYMBOL is defined or re-exported
//
// DELIBERATELY CONSERVATIVE. Every ambiguity is a skip, never an accusation. Python re-exports
// through `__init__.py`, `__all__`, star-imports and runtime registration, so "not found by a
// regex" is not proof of absence. A MISSING MODULE is reported as an error because that is
// unambiguous; a missing symbol inside a module that exists is reported only when the module has
// no star-import and no dynamic `__getattr__`, and is otherwise skipped and counted.

import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { LIBRARY_REGISTRY } from './lib/registry-resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const argv = process.argv.slice(2);
const wantCheck = argv.includes('--check');
const SCAN_DIR = join(ROOT, 'src', 'skills');

// Only packages we have deliberately mapped are checked. An unmapped import is skipped and
// counted, exactly like the npm gate: an honest skip beats a confident guess.
const PYPI = new Set(Object.entries(LIBRARY_REGISTRY).filter(([, r]) => r === 'pypi').map(([k]) => k));

// Standard library and common local aliases never resolve to a PyPI package.
const STDLIB = new Set([
  'os', 'sys', 're', 'json', 'time', 'typing', 'asyncio', 'pathlib', 'dataclasses', 'datetime',
  'collections', 'functools', 'itertools', 'logging', 'subprocess', 'contextlib', 'enum', 'math',
  'random', 'statistics', 'uuid', 'hashlib', 'base64', 'unittest', 'abc', 'copy', 'shutil', 'io',
  'threading', 'signal', 'traceback', 'warnings', 'inspect', 'textwrap', 'string', 'secrets',
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.md')) out.push(p);
  }
  return out;
}

/** ```python fences only. A bash fence that mentions `import` is not a Python import. */
function pyFences(md) {
  const out = [];
  const re = /```(?:python|py)\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(md)) !== null) out.push(m[1]);
  return out;
}

/** `from a.b.c import X, Y` -> { module: 'a.b.c', names: ['X','Y'] } */
function fromImports(code) {
  const out = [];
  const re = /^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+([^\n#]+)/gm;
  let m;
  while ((m = re.exec(code)) !== null) {
    const module = m[1];
    if (module.startsWith('.')) continue; // relative
    const names = m[2]
      .replace(/[()\\]/g, ' ')
      .split(',')
      .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      .filter((s) => s && s !== '*' && /^[A-Za-z_]\w*$/.test(s));
    if (names.length) out.push({ module, names });
  }
  return out;
}

/** Parse ">=1.28.0,<2.0.0" into { min, max, maxInclusive }. */
function parseRange(expr) {
  const s = String(expr ?? '');
  const lo = /(?:>=|\^|~)?\s*v?(\d+)\.(\d+)(?:\.(\d+))?/.exec(s);
  const hi = /<\s*(=?)\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(s);
  return {
    min: lo ? [Number(lo[1]), Number(lo[2]), Number(lo[3] ?? 0)] : null,
    max: hi ? [Number(hi[2]), Number(hi[3] ?? 0), Number(hi[4] ?? 0)] : null,
    maxInclusive: hi ? hi[1] === '=' : false,
  };
}
const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
const semver = (v) => { const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(String(v)); return m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : null; };

/** Collect each skill's declared floor per library, so we test the version the skill CLAIMS. */
function declaredFloors() {
  const map = new Map();
  const skills = join(ROOT, 'src', 'skills');
  for (const d of readdirSync(skills, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const p = join(skills, d.name, 'SKILL.md');
    if (!existsSync(p)) continue;
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(p, 'utf8'));
    if (!fm) continue;
    const block = /^targets:\s*\n((?:[ \t]+.*\n)+)/m.exec(fm[1]);
    if (!block) continue;
    const re = /-\s*library:\s*"?([A-Za-z0-9@/._-]+)"?\s*\n\s*version:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(block[1])) !== null) map.set(m[1], m[2]);
  }
  return map;
}

const httpCache = new Map();
async function getJson(url) {
  if (httpCache.has(url)) return httpCache.get(url);
  let v = null;
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } });
    if (r.ok) v = await r.json();
  } catch { /* network failure is a skip, not an accusation */ }
  httpCache.set(url, v);
  return v;
}

/** Highest published version satisfying the declared range. */
function pickVersion(releases, range) {
  const cands = Object.keys(releases)
    .map((v) => ({ v, s: semver(v) }))
    .filter((x) => x.s && releases[x.v] && releases[x.v].length)
    .filter((x) => !range.min || cmp(x.s, range.min) >= 0)
    .filter((x) => {
      if (!range.max) return true;
      const d = cmp(x.s, range.max);
      return range.maxInclusive ? d <= 0 : d < 0;
    })
    .sort((a, b) => cmp(a.s, b.s));
  return cands.length ? cands[cands.length - 1].v : null;
}

/** Distribution names a package declares as runtime dependencies (extras excluded). */
const depCache = new Map();
async function dependencyNames(pkg) {
  if (depCache.has(pkg)) return depCache.get(pkg);
  const meta = await getJson(`https://pypi.org/pypi/${pkg}/json`);
  const names = [];
  // Extras ARE included. The question this answers is "does this module exist anywhere in the
  // package's own ecosystem", not "is it installed by default". `langgraph.checkpoint.postgres`
  // ships in langgraph-checkpoint-postgres, which langgraph declares as an EXTRA; documenting it
  // is correct as long as the reader installs the extra, so it must not be reported as broken.
  for (const req of meta?.info?.requires_dist || []) {
    const m = /^\s*([A-Za-z0-9._-]+)/.exec(req);
    if (m && m[1].toLowerCase() !== pkg.toLowerCase()) names.push(m[1]);
  }
  depCache.set(pkg, names);
  return names;
}

/** True when some declared dependency also ships files under `<root>/`, i.e. a namespace package. */
const nsCache = new Map();
async function isNamespaceRoot(root) {
  if (nsCache.has(root)) return nsCache.get(root);
  let ns = false;
  for (const dep of await dependencyNames(root)) {
    const w = await wheelFor(dep, { min: null, max: null, maxInclusive: false });
    if (w.status !== 'ok') continue;
    if (w.files.some((f) => f.startsWith(`${root}/`))) { ns = true; break; }
  }
  nsCache.set(root, ns);
  return ns;
}

const wheelCache = new Map();
async function wheelFor(pkg, range) {
  const key = `${pkg}@${JSON.stringify(range)}`;
  if (wheelCache.has(key)) return wheelCache.get(key);
  let result = { status: 'unresolved' };
  const meta = await getJson(`https://pypi.org/pypi/${pkg}/json`);
  if (!meta) {
    result = { status: 'not-published' };
  } else {
    const version = pickVersion(meta.releases || {}, range);
    if (!version) {
      result = { status: 'no-version-in-range' };
    } else {
      const rel = await getJson(`https://pypi.org/pypi/${pkg}/${version}/json`);
      const whl = (rel?.urls || []).find((u) => u.url.endsWith('.whl'));
      if (!whl) result = { status: 'no-wheel', version };
      else {
        try {
          const dir = mkdtempSync(join(tmpdir(), 'pysym-'));
          const file = join(dir, 'p.whl');
          const buf = Buffer.from(await (await fetch(whl.url)).arrayBuffer());
          writeFileSync(file, buf);
          const listing = execFileSync('unzip', ['-Z1', file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
          result = { status: 'ok', version, file, files: listing.split('\n').filter(Boolean) };
        } catch {
          result = { status: 'fetch-failed', version };
        }
      }
    }
  }
  wheelCache.set(key, result);
  return result;
}

/** Does `a.b.c` exist as a package dir or module file inside the wheel? */
function modulePaths(info, module) {
  const p = module.split('.').join('/');
  return {
    pkgInit: info.files.find((f) => f === `${p}/__init__.py`),
    modFile: info.files.find((f) => f === `${p}.py`),
    anyUnder: info.files.some((f) => f.startsWith(`${p}/`)),
  };
}

function readMember(info, path) {
  try {
    return execFileSync('unzip', ['-p', info.file, path], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch { return null; }
}

// ---------------------------------------------------------------------------
const floors = declaredFloors();
const files = walk(SCAN_DIR);
const sites = [];
for (const f of files) {
  const md = readFileSync(f, 'utf8');
  for (const fence of pyFences(md)) {
    for (const imp of fromImports(fence)) sites.push({ file: f, ...imp });
  }
}

const missingModules = [];
const missingSymbols = [];
const skipped = { stdlib: 0, unmapped: 0, noWheel: 0, ambiguous: 0, network: 0, namespacePkg: 0 };
let checkedModules = 0, checkedSymbols = 0;

for (const site of sites) {
  const root = site.module.split('.')[0];
  if (STDLIB.has(root)) { skipped.stdlib++; continue; }
  if (!PYPI.has(root)) { skipped.unmapped++; continue; }

  const range = parseRange(floors.get(root) ?? '');
  const info = await wheelFor(root, range);
  if (info.status === 'not-published') { missingModules.push({ ...site, reason: `package ${root} is not published on PyPI` }); continue; }
  if (info.status !== 'ok') { if (info.status === 'fetch-failed') skipped.network++; else skipped.noWheel++; continue; }

  checkedModules++;
  const mp = modulePaths(info, site.module);
  if (!mp.pkgInit && !mp.modFile && !mp.anyUnder) {
    // NAMESPACE PACKAGES. A module path does not have to live in the distribution its first
    // segment names. `langgraph.prebuilt` ships in the separate `langgraph-prebuilt`
    // distribution, so the `langgraph` wheel legitimately does not contain it.
    //
    // EXISTENCE OF A SIBLING NAME IS NOT PROOF. The first version of this check skipped whenever
    // a distribution with the sibling name existed, and that silently suppressed the single most
    // important finding in the repo: an UNRELATED package literally named `mcp-server` (0.1.4) is
    // published, so `mcp.server.fastmcp` was waved through while being genuinely absent from
    // mcp 2.0. A false negative in a gate is worse than a false positive, because nobody ever
    // looks again. So the sibling must actually CONTAIN the module path.
    // Guessing sibling NAMES does not work either: `langgraph.store.base` and
    // `langgraph.cache.memory` both ship in `langgraph-checkpoint`, which no name-derivation
    // from the module path would ever produce. Ask the package instead. A namespace module is
    // provided by one of the root distribution's own declared dependencies, so walk
    // `requires_dist` and look for the path there. That resolves langgraph correctly AND still
    // reports mcp, because `mcp` does not depend on the unrelated `mcp-server` package.
    // FINAL FORM, after two wrong attempts recorded above. Dependency-walking is also not
    // enough: `langgraph.store.postgres` ships in `langgraph-checkpoint-postgres`, which
    // langgraph does not declare AT ALL (verified against requires_dist on 1.2.10). A namespace
    // module can live in ANY distribution, including ones the root has never heard of, so
    // absence from the root wheel is simply not evidence of absence.
    //
    // So the unit of judgement is the ROOT, not the module: if any distribution the root depends
    // on also ships files under `<root>/`, the root is a namespace package and module-level
    // accusations about it are unsound. Skip the whole root and say so in the summary.
    //
    // This keeps the finding that matters. `mcp` is NOT a namespace root (none of its deps ship
    // `mcp/`), so `mcp.server.fastmcp` is still reported, correctly.
    if (await isNamespaceRoot(root)) { skipped.namespacePkg++; continue; }
    missingModules.push({ ...site, reason: `module ${site.module} absent from ${root}@${info.version}`, version: info.version });
    continue;
  }

  const src = readMember(info, mp.pkgInit || mp.modFile || '');
  if (!src) { skipped.ambiguous++; continue; }
  // Re-export machinery makes absence unprovable. Skip rather than accuse.
  if (/^\s*from\s+[.\w]+\s+import\s+\*/m.test(src) || /__getattr__/.test(src)) { skipped.ambiguous += site.names.length; continue; }

  for (const name of site.names) {
    checkedSymbols++;
    // `from sqlalchemy import event` imports a SUBMODULE, not a name bound in __init__.py.
    // sqlalchemy/event/__init__.py exists, so the import is valid even though `event` never
    // appears as a def/class/assignment. Check the filesystem shape before the source text.
    const base = site.module.split('.').join('/');
    if (info.files.some((f) => f === `${base}/${name}.py` || f === `${base}/${name}/__init__.py`)) continue;
    const defined =
      new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\b`, 'm').test(src) ||
      new RegExp(`^\\s*class\\s+${name}\\b`, 'm').test(src) ||
      new RegExp(`^\\s*${name}\\s*[:=]`, 'm').test(src) ||
      new RegExp(`\\bimport\\s+[^\\n]*\\b${name}\\b`, 'm').test(src) ||
      new RegExp(`["']${name}["']`).test(src);
    if (!defined) missingSymbols.push({ ...site, name, version: info.version });
  }
}

console.log('==========================================');
console.log('  python import-symbol gate');
console.log('==========================================\n');
console.log(`  scanned files        : ${files.length}`);
console.log(`  python import sites  : ${sites.length}`);
console.log(`  modules verified     : ${checkedModules}`);
console.log(`  symbols verified     : ${checkedSymbols}`);
console.log('\n  skipped (NOT verified):');
console.log(`    stdlib             : ${skipped.stdlib}`);
console.log(`    unmapped packages  : ${skipped.unmapped}   (add to LIBRARY_REGISTRY to cover)`);
console.log(`    no wheel published : ${skipped.noWheel}`);
console.log(`    re-export ambiguity: ${skipped.ambiguous}   (star-import or __getattr__)`);
console.log(`    network failures   : ${skipped.network}`);
console.log(`    namespace packages : ${skipped.namespacePkg}   (module ships in a sibling distribution)`);

if (missingModules.length) {
  console.log(`\n  MODULES NOT FOUND (${missingModules.length}):`);
  for (const m of missingModules) {
    console.log(`    ${relative(ROOT, m.file)}`);
    console.log(`      from ${m.module} import ${m.names.join(', ')}   — ${m.reason}`);
  }
}
if (missingSymbols.length) {
  console.log(`\n  SYMBOLS NOT FOUND (${missingSymbols.length}):`);
  for (const s of missingSymbols) {
    console.log(`    ${relative(ROOT, s.file)}`);
    console.log(`      ${s.name} from ${s.module}   — absent in ${s.module.split('.')[0]}@${s.version}`);
  }
}

const broken = missingModules.length + missingSymbols.length;
if (!broken) console.log('\nEvery verified python import resolves to a published module and symbol.');
else console.log(`\n${broken} broken python import(s).`);
if (wantCheck && broken) process.exit(1);
