#!/usr/bin/env node
// scripts/check-labs-versions.mjs — verify upstream pins + declared floors in skill frontmatter
//
// Usage:
//   node scripts/check-labs-versions.mjs            # report drift, exit 0
//   node scripts/check-labs-versions.mjs --check    # report drift, exit 1 if stale
//   node scripts/check-labs-versions.mjs --apply    # rewrite frontmatter + exit 0
//
// TWO CHECKS, TWO MEANINGS — do not conflate them:
//
//   PIN   `upstream-version-tested:`  "this is the release we actually read".
//         Any difference is drift; --apply bumps it and the workflow opens a PR.
//
//   FLOOR `targets: [{library, version}]` "the minimum this skill's content requires".
//         A FLOOR IS NOT A PIN. `>=1.2.0` against latest 1.2.9 is SATISFIED and reports ok.
//         Only a floor that upstream has outgrown by a minor/major, or that latest cannot
//         satisfy at all, is worth a human's attention. Firing on every patch would make this
//         gate noise, and a noisy gate gets muted — which is how it dies.
//
// WHAT NEITHER CHECK CAN CATCH: a symbol that never existed at any version. `LangfuseExporter`
// was imported in four skill files and is absent from every published build of @langfuse/otel;
// no version comparison would ever flag it. That needs an import-symbol gate (separate).

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  resolveLibrary,
  fetchLatest,
  compareFloor,
  comparePin,
} from './lib/registry-resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// skill-relative-path → package name to query. Registry is resolved from LIBRARY_REGISTRY.
const TARGETS = [
  { skill: 'src/skills/emulate-seed/SKILL.md', pkg: 'emulate' },
  { skill: 'src/skills/portless/SKILL.md', pkg: 'portless' },
  { skill: 'src/skills/browser-tools/SKILL.md', pkg: 'agent-browser' },
  { skill: 'src/skills/json-render-catalog/SKILL.md', pkg: '@json-render/core' },
  { skill: 'src/skills/multi-surface-render/SKILL.md', pkg: '@json-render/core' },
  { skill: 'src/skills/mcp-visual-output/SKILL.md', pkg: '@json-render/mcp' },
  { skill: 'src/skills/expect/SKILL.md', pkg: 'agent-browser' },
  // LangChain ecosystem — PyPI, invisible to this gate until the dual-registry resolver landed.
  { skill: 'src/skills/langgraph/SKILL.md', pkg: 'langgraph' },
  { skill: 'src/skills/monitoring-observability/SKILL.md', pkg: 'langfuse' },
];

// Track-only tier (M127 #1557 wterm decision).
// Packages we want to be notified about but haven't built a skill around yet.
// Drift is reported but never auto-applied (no SKILL.md to update).
const TRACK_ONLY = [
  { pkg: '@wterm/dom', pinned: '0.2.1', note: 'Terminal-emulator-for-web; see #1557 — track-only decision (2026-05-03).' },
  { pkg: '@wterm/react', pinned: '0.2.1', note: 'React adapter for wterm; same decision as @wterm/dom.' },
  // Upstream itself is dormant; ork teaches hand-rolled supervisors instead. Revisit only if
  // these resume releases — a bump here is a signal to reconsider, not a task.
  { pkg: 'langgraph-supervisor', pinned: '0.0.31', note: 'Dormant upstream (last release 2025-11). ork teaches hand-rolled supervisors — do not adopt without a fresh decision.' },
  { pkg: 'langgraph-swarm', pinned: '0.1.0', note: 'Dormant upstream (last release 2025-12). Track-only for the same reason as langgraph-supervisor.' },
];

const args = new Set(process.argv.slice(2));
const mode = args.has('--apply') ? 'apply' : args.has('--check') ? 'check' : 'report';

function readPinned(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const m = content.match(/^\s*upstream-version-tested:\s*"?([0-9]+\.[0-9]+\.[0-9]+)"?\s*$/m);
  return m ? { version: m[1], content } : null;
}

function applyUpdate(filePath, newVersion) {
  const content = readFileSync(filePath, 'utf8');
  const updated = content.replace(
    /^(\s*upstream-version-tested:\s*)"?[0-9]+\.[0-9]+\.[0-9]+"?(\s*)$/m,
    `$1"${newVersion}"$2`
  );
  if (updated === content) {
    throw new Error(`refused to write — replacement did not change ${filePath}`);
  }
  writeFileSync(filePath, updated);
}

/** Every `targets:` floor declared across all skills, so new skills are covered without edits here. */
function collectFloors() {
  const skillsDir = join(ROOT, 'src', 'skills');
  const out = [];
  for (const dir of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const p = join(skillsDir, dir.name, 'SKILL.md');
    if (!existsSync(p)) continue;
    const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(p, 'utf8'));
    if (!fm) continue;
    const block = /^targets:\s*\n((?:[ \t]+.*\n)+)/m.exec(fm[1]);
    if (!block) continue;
    const re = /-\s*library:\s*"?([A-Za-z0-9@/._-]+)"?\s*\n\s*version:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(block[1])) !== null) {
      out.push({ skill: dir.name, library: m[1], floor: m[2] });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// PIN check
// ---------------------------------------------------------------------------
console.log('==========================================');
console.log('  upstream pins (upstream-version-tested)');
console.log('==========================================\n');

const drift = [];
for (const { skill, pkg } of TARGETS) {
  const path = join(ROOT, skill);
  const pinned = readPinned(path);
  if (!pinned) {
    console.error(`SKIP: ${skill} has no upstream-version-tested frontmatter`);
    continue;
  }
  const resolved = resolveLibrary(pkg);
  if (!resolved) {
    console.error(`SKIP: ${pkg} has no entry in LIBRARY_REGISTRY — add one, do not guess`);
    continue;
  }
  const registry = resolved.registry;
  const latest = await fetchLatest(pkg);
  if (!latest) {
    console.error(`SKIP: could not fetch ${pkg} from ${registry}`);
    continue;
  }
  const verdict = comparePin(pinned.version, latest);
  if (verdict.severity === 'current') {
    console.log(`OK    ${pkg.padEnd(24)} ${pinned.version} (current, ${registry})`);
  } else if (verdict.severity === 'ahead-of-upstream') {
    console.log(`AHEAD ${pkg.padEnd(24)} ${pinned.version} > ${latest} — pin claims an unpublished release`);
  } else {
    console.log(`DRIFT ${pkg.padEnd(24)} ${pinned.version} → ${latest}  [${verdict.severity}, ${registry}]`);
    drift.push({ skill, path, pkg, from: pinned.version, to: latest, severity: verdict.severity });
  }
}

// ---------------------------------------------------------------------------
// FLOOR check (advisory — never fails --check, never auto-applied)
// ---------------------------------------------------------------------------
console.log('\n==========================================');
console.log('  declared floors (targets:)');
console.log('==========================================\n');

const floorLag = [];
for (const { skill, library, floor } of collectFloors()) {
  const resolved = resolveLibrary(library);
  if (!resolved) {
    console.log(`SKIP  ${library.padEnd(24)} (${skill}) — not in LIBRARY_REGISTRY`);
    continue;
  }
  const registry = resolved.registry;
  const latest = await fetchLatest(library);
  if (!latest) {
    console.log(`SKIP  ${library.padEnd(24)} (${skill}) — could not fetch from ${registry}`);
    continue;
  }
  const v = compareFloor(floor, latest);
  if (v.severity === 'ok') {
    console.log(`ok    ${library.padEnd(24)} ${floor} satisfied by ${latest} (${skill})`);
  } else {
    console.log(`${v.severity.toUpperCase().padEnd(5)} ${library.padEnd(24)} ${floor} vs latest ${latest} (${skill})`);
    floorLag.push({ skill, library, floor, latest, severity: v.severity });
  }
}

// ---------------------------------------------------------------------------
// Track-only tier
// ---------------------------------------------------------------------------
const trackingDrift = [];
if (TRACK_ONLY.length > 0) {
  console.log('');
  for (const { pkg, pinned, note } of TRACK_ONLY) {
    const latest = await fetchLatest(pkg);
    if (!latest) {
      console.error(`SKIP (track) ${pkg} — could not fetch`);
      continue;
    }
    if (pinned === latest) {
      console.log(`OK    ${pkg.padEnd(24)} ${pinned} (track-only, current)`);
    } else {
      console.log(`TRACK ${pkg.padEnd(24)} ${pinned} → ${latest}   ${note}`);
      trackingDrift.push({ pkg, from: pinned, to: latest, note });
    }
  }
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
if (floorLag.length > 0) {
  console.log(`\n${floorLag.length} declared floor(s) behind upstream — advisory, review content coverage.`);
  const unsat = floorLag.filter((f) => f.severity === 'unsatisfiable');
  if (unsat.length > 0) {
    console.error(`\n${unsat.length} floor(s) CANNOT be satisfied by any published release:`);
    for (const f of unsat) console.error(`  ${f.skill}: ${f.library} ${f.floor} but latest is ${f.latest}`);
  }
}

if (drift.length === 0 && trackingDrift.length === 0) {
  console.log('\nAll pins are current.');
  process.exit(0);
}

if (drift.length === 0 && trackingDrift.length > 0) {
  console.log(`\n${trackingDrift.length} track-only package(s) have new versions — review and decide whether to adopt.`);
  // Track-only never fails --check; it's an information signal only.
  process.exit(0);
}

if (mode === 'apply') {
  for (const d of drift) {
    applyUpdate(d.path, d.to);
    console.log(`UPDATED ${d.skill} (${d.from} → ${d.to})`);
  }
  console.log(`\nApplied ${drift.length} update(s). Body version mentions may need manual review.`);
  process.exit(0);
}

if (mode === 'check') {
  console.log(`\n${drift.length} skill(s) drifted. Run --apply to update.`);
  process.exit(1);
}

console.log(`\n${drift.length} skill(s) drifted. Run --apply to update or --check to fail CI.`);
