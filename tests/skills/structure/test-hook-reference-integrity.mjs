#!/usr/bin/env node
// ============================================================================
// Hook Reference Integrity  (the #959 / #1264 class, frontmatter side)
// ============================================================================
// WHAT IT GUARDS
//   Skills and agents can attach hooks in their frontmatter:
//
//     hooks:
//       PreToolUse:
//         - matcher: "Read"
//           command: "${CLAUDE_PLUGIN_ROOT}/hooks/bin/run-hook.mjs skill/assessment-baseline-loader"
//
//   That string is resolved at runtime in three steps by run-hook.mjs:
//
//     1. prefix  = name.split('/')[0]          e.g. "skill"
//     2. bundle  = bundleMap[prefix]           unknown prefix -> SILENT EXIT
//     3. handler = hooks[<full name>]          missing key    -> SILENT EXIT
//
//   Both misses are silent. The hook simply never runs, and nothing reports it.
//   That is exactly how #1264 happened: `instructions-loaded`, `elicitation`
//   and `config-change` handlers existed in the lifecycle bundle but had no
//   prefix mapping, so they were born dead and stayed dead for about three
//   months. run-hook.mjs still carries the comment.
//
// THE GAP THIS FILLS
//   `src/hooks/src/__tests__/e2e/hooks-json-wiring.test.ts` already checks
//   hooks.json against the entry bundles. Nothing checked the OTHER caller:
//   the 66 `run-hook.mjs` references living in skill and agent frontmatter
//   across 31 distinct hook names. Those had zero coverage.
//
//   At the time of writing all 66 resolve. This is therefore a ratchet against
//   a gap, not a fix for a live bug, and both counts are hard zeros because
//   there is no debt to pay down.
//
// SELF-CHECK, AND WHY IT IS NOT OPTIONAL
//   Every guard touched during this campaign reported clean because it could
//   not see, not because there was nothing there: a linter matching one of two
//   YAML list shapes printed DEAD-EDGE 0 with five in front of it, and a
//   coverage metric counted non-resolving declarations as proof of
//   reachability. "Found nothing" and "looked at nothing" are indistinguishable
//   from the outside.
//
//   So this file refuses to pass on an empty reading. If the bundle map, the
//   registry, or the reference scan comes back empty, or any single entries
//   file contributes no names, it FAILS rather than reporting success. A gate
//   that cannot prove it read something is worth less than no gate.
//
// SOURCES OF TRUTH, NOT COPIES
//   The prefix list is parsed out of run-hook.mjs and the hook names out of
//   entries/*.ts. Hardcoding either here would create a fourth thing to drift.
//
// USAGE
//   node tests/skills/structure/test-hook-reference-integrity.mjs
//   node tests/skills/structure/test-hook-reference-integrity.mjs --list
// ============================================================================

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RUN_HOOK = join(REPO, 'src', 'hooks', 'bin', 'run-hook.mjs');
const ENTRIES = join(REPO, 'src', 'hooks', 'src', 'entries');
const SKILLS = join(REPO, 'src', 'skills');
const AGENTS = join(REPO, 'src', 'agents');

const fail = (msg) => {
  console.log(`\nFAILED: ${msg}`);
  process.exit(1);
};

/** Frontmatter block only. A body mention must never count. */
function frontmatter(text) {
  if (!text.startsWith('---')) return '';
  const parts = text.split('---');
  return parts.length >= 3 ? parts[1] : '';
}

/** Prefixes run-hook.mjs can actually route, read from its own bundleMap. */
function loadPrefixes() {
  const src = readFileSync(RUN_HOOK, 'utf8');
  const block = src.match(/const bundleMap = \{([\s\S]*?)\};/);
  if (!block) fail('could not locate bundleMap in run-hook.mjs; the resolver changed shape');
  return new Set([...block[1].matchAll(/^\s*'?([a-z-]+)'?\s*:/gm)].map((m) => m[1]));
}

/** Every hook name registered across the entry bundles, with a per-file check. */
function loadRegistered() {
  const names = new Set();
  const perFile = [];
  for (const f of readdirSync(ENTRIES).filter((n) => n.endsWith('.ts')).sort()) {
    const src = readFileSync(join(ENTRIES, f), 'utf8');
    // Anchor on the colon. `hooks[^=]*=` also matches `export const hooksFoo`,
    // which made a rename control silently keep passing while I was verifying
    // this file. A loose anchor is how a reader goes blind without saying so.
    const rec = src.match(/export const hooks\s*:[^=]*=\s*\{([\s\S]*?)\n\};/);
    const found = rec ? [...rec[1].matchAll(/^\s*'([a-z0-9/._-]+)'\s*:/gm)].map((m) => m[1]) : [];
    for (const n of found) names.add(n);
    perFile.push({ file: f, count: found.length, matched: Boolean(rec) });
  }
  return { names, perFile };
}

/** Every run-hook.mjs reference in skill and agent frontmatter. */
function loadReferences() {
  const refs = new Map(); // name -> [source files]
  const add = (file, fm) => {
    for (const m of fm.matchAll(/run-hook\.mjs\s+([a-z0-9/._-]+)/g)) {
      if (!refs.has(m[1])) refs.set(m[1], []);
      refs.get(m[1]).push(file);
    }
  };
  for (const d of readdirSync(SKILLS)) {
    const p = join(SKILLS, d, 'SKILL.md');
    if (existsSync(p)) add(`src/skills/${d}/SKILL.md`, frontmatter(readFileSync(p, 'utf8')));
  }
  for (const n of readdirSync(AGENTS)) {
    if (!n.endsWith('.md') || n === 'README.md') continue;
    add(`src/agents/${n}`, frontmatter(readFileSync(join(AGENTS, n), 'utf8')));
  }
  return refs;
}

const prefixes = loadPrefixes();
const { names: registered, perFile } = loadRegistered();
const refs = loadReferences();
const mentions = [...refs.values()].reduce((a, v) => a + v.length, 0);

const unknownPrefix = [];
const unregistered = [];
for (const [name, sources] of refs) {
  if (!prefixes.has(name.split('/')[0])) unknownPrefix.push({ name, sources });
  else if (!registered.has(name)) unregistered.push({ name, sources });
}

if (process.argv.includes('--list')) {
  for (const [n, s] of refs) console.log(`${n}\t${s.length}\t${s[0]}`);
  process.exit(0);
}

console.log('='.repeat(70));
console.log('  Hook Reference Integrity (#959 / #1264 class)');
console.log('='.repeat(70));
console.log(`  bundleMap prefixes : ${prefixes.size}`);
console.log(`  registered hooks   : ${registered.size} across ${perFile.length} entry bundles`);
console.log(`  frontmatter refs   : ${refs.size} distinct (${mentions} mentions)`);
console.log(`  UNKNOWN-PREFIX     : ${unknownPrefix.length} (must be 0)`);
console.log(`  UNREGISTERED       : ${unregistered.length} (must be 0)`);

// --- self-check: refuse to pass on an empty reading -------------------------
if (prefixes.size === 0) fail('read 0 bundleMap prefixes; the scan is blind, not clean');
if (registered.size === 0) fail('read 0 registered hooks; the scan is blind, not clean');
if (refs.size === 0) fail('read 0 frontmatter references; the scan is blind, not clean');
const blind = perFile.filter((e) => !e.matched || e.count === 0);
if (blind.length) {
  console.log('\n== BLIND ENTRY BUNDLES ==');
  console.log('   No hook names were extracted from these, so any reference into');
  console.log('   them would be wrongly reported as unregistered, or wrongly cleared.');
  for (const e of blind) console.log(`   ${e.file}  (matched record: ${e.matched})`);
  fail(`${blind.length} entry bundle(s) yielded no hook names`);
}

if (unknownPrefix.length) {
  console.log(`\n== UNKNOWN-PREFIX (${unknownPrefix.length}) ==`);
  console.log('   run-hook.mjs has no bundleMap entry for this prefix, so it exits');
  console.log('   silently and the hook never runs. Add the prefix, or fix the name.');
  for (const e of unknownPrefix) console.log(`   ${e.name}  <- ${e.sources.join(', ')}`);
}

if (unregistered.length) {
  console.log(`\n== UNREGISTERED (${unregistered.length}) ==`);
  console.log('   The prefix routes to a bundle, but no entries/*.ts exports a hook');
  console.log('   under this name, so the lookup misses and the hook never runs.');
  for (const e of unregistered) console.log(`   ${e.name}  <- ${e.sources.join(', ')}`);
}

if (unknownPrefix.length || unregistered.length) {
  fail(`${unknownPrefix.length} unknown prefixes, ${unregistered.length} unregistered hook names`);
}

console.log(
  `\nSUCCESS: all ${mentions} frontmatter hook references resolve ` +
    `(${refs.size} distinct names against ${registered.size} registered)`,
);
process.exit(0);
