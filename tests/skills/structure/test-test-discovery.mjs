#!/usr/bin/env node
// ============================================================================
// Test Discovery Ratchet  (issue #3220)
// ============================================================================
// WHAT IT GUARDS
//   `tests/run-all-tests.sh` dispatches with explicit lines:
//
//     run_test "Hook Registry Closure (#959/#2886)" "$SCRIPT_DIR/unit/test-hook-registry-closure.sh"
//
//   HISTORY: at the time of writing there was no glob discovery anywhere, so
//   a test file that nobody wired never ran, forever. Since v4 (#3235) the
//   runner globs whole directories, so in-glob files are executed by
//   construction; this ratchet now guards only the residue OUTSIDE the
//   globbed dirs (see GLOBBED_DIRS below). The original failure mode — a
//   file whose existence implies coverage that is not there — is unchanged.
//
//   Measured at the time of writing: 58 of 239 test files (24%) were
//   referenced by nothing at all.
//
// THIS IS NOT A HYPOTHETICAL
//   All 58 were executed by hand during triage for #3220. 57 passed, which is
//   the good news: they are dormant, not rotten. The one failure,
//   tests/plugins/test-cc-discovery-simulation.sh, had TWO real defects that
//   had been invisible for as long as it was unwired:
//
//     1. It read `.claude-plugin/plugin.json` from the repo root, a path that
//        stopped existing when the single-plugin `plugins/ork/` layout landed.
//     2. `((total_skills++))` under `set -e`. Post-increment returns the value
//        BEFORE incrementing, so at 0 it returns 1 and kills the script on the
//        very first skill. It could never have passed on any machine.
//
//   Both are fixed in the same change as this file. Neither would have been
//   found without running an orphan by hand.
//
// WHY A RATCHET AND NOT A HARD ZERO
//   Zero would mean wiring all 58 into the runner in this change. They all
//   pass, so that is low-risk, but it is a real CI-time increase that deserves
//   its own measurement rather than riding along here. The ratchet freezes the
//   debt so it cannot grow while that happens: a NEW unreferenced test file
//   fails CI the day it is written, which is the failure mode that produced
//   these 58 in the first place.
//
//   Lower ORPHAN_BASELINE as tests get wired up. It may only fall.
//
// METHOD, AND THE TRAP IN IT
//   Read every git-tracked file ONCE and record which candidate basenames it
//   mentions, ignoring self-references. A file is an orphan only when NO OTHER
//   file mentions it. The per-candidate `git grep` version of this was correct
//   but spawned 241 subprocesses and took over two minutes, too slow to live in
//   `npm run test:skills`; the single pass runs in about 8 seconds.
//
//   The first version of this measurement searched only package.json, the
//   workflows directory and two shallow tests/ globs, and reported 107. That
//   over-counted by missing references from deeper paths. Narrow search scope
//   produces both false positives and false negatives, and this file has been
//   burned by the second kind already (#3219). Search everything git tracks.
//
// USAGE
//   node tests/skills/structure/test-test-discovery.mjs
//   node tests/skills/structure/test-test-discovery.mjs --list
// ============================================================================

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Lower this as tests are wired into a runner. Never raise it.
const ORPHAN_BASELINE = 1;

const TEST_EXT = new Set(['sh', 'mjs', 'js']);
const isCandidate = (name) =>
  (name.startsWith('test-') || name.startsWith('run-')) && TEST_EXT.has(name.split('.').pop());

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (isCandidate(entry)) out.push(p);
  }
  return out;
}

const candidates = walk(join(REPO, 'tests')).sort();
const names = new Set(candidates.map((p) => basename(p)));

/**
 * Build the referenced-name set in ONE pass over the tracked tree.
 *
 * The obvious implementation, `git grep -l <basename>` per candidate, spawns
 * one subprocess per test file. At 241 files that took over two minutes, which
 * is too slow to sit in `npm run test:skills`. Reading every tracked file once
 * and matching all names against it runs in a couple of seconds.
 *
 * A name counts as referenced only when some OTHER file mentions it, so a
 * script that names itself in a usage comment is still an orphan.
 */
function buildReferencedSet() {
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const referenced = new Set();
  for (const rel of tracked) {
    const self = basename(rel);
    let text;
    try {
      text = readFileSync(join(REPO, rel), 'utf8');
    } catch {
      continue; // binary, symlink, or removed since ls-files
    }
    for (const name of names) {
      if (name !== self && text.includes(name)) referenced.add(name);
    }
  }
  return referenced;
}

const referenced = buildReferencedSet();

// v4 (#3235): run-all-tests.sh became an orchestrator over the same recursive
// glob CI uses, so a test file inside any globbed tests/<dir> is EXECUTED by
// construction — no by-name reference exists or is needed. This ratchet's job
// therefore shrinks to the residue the glob cannot see: candidates OUTSIDE
// every globbed directory that nothing references by name. Keep this list in
// lockstep with the run_dir calls in tests/run-all-tests.sh and the
// run-tests.sh invocations in .github/workflows/ci.yml. tests/fixtures is
// deliberately absent on both surfaces (sourced library, not tests).
const GLOBBED_DIRS = new Set([
  'agents', 'build', 'ci', 'compliance', 'config', 'e2e', 'evals',
  'external', 'feedback', 'hooks', 'indexes', 'integration', 'manifests',
  'orphans', 'performance', 'plugins', 'schemas', 'security', 'skills',
  'subagents', 'unit', 'worktree',
]);
const coveredByGlob = (p) => {
  const rel = p.slice(REPO.length + 1); // tests/<dir>/...
  const parts = rel.split('/');
  return parts[0] === 'tests' && GLOBBED_DIRS.has(parts[1]) && basename(p).startsWith('test-');
};

const orphans = candidates.filter((p) => !coveredByGlob(p) && !referenced.has(basename(p)));

if (process.argv.includes('--list')) {
  for (const o of orphans) console.log(o.slice(REPO.length + 1));
  process.exit(0);
}

console.log('='.repeat(70));
console.log('  Test Discovery Ratchet (#3220)');
console.log('='.repeat(70));
console.log(`  test files found : ${candidates.length}`);
console.log(`  ORPHANED         : ${orphans.length} / ${ORPHAN_BASELINE} baseline`);

if (orphans.length > ORPHAN_BASELINE) {
  console.log(`\n== REGRESSION (${orphans.length} > ${ORPHAN_BASELINE}) ==`);
  console.log('   These test files are referenced by no runner, workflow or script,');
  console.log('   so nothing will ever execute them. Wire them up or delete them.');
  for (const o of orphans) console.log(`   ${o.slice(REPO.length + 1)}`);
  console.log(`\nFAILED: orphaned test count rose to ${orphans.length}`);
  process.exit(1);
}

if (orphans.length < ORPHAN_BASELINE) {
  console.log(
    `\n  NOTE: orphan count fell to ${orphans.length}. Lower ORPHAN_BASELINE ` +
      `to ${orphans.length} to lock the gain in.`,
  );
}

console.log(`\nSUCCESS: orphaned tests held at ${orphans.length} (baseline ${ORPHAN_BASELINE})`);
process.exit(0);
