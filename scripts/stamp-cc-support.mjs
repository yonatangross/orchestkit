#!/usr/bin/env node
/**
 * stamp-cc-support.mjs — propagate shared/cc-support.json values into derived files.
 *
 * Single source of truth: shared/cc-support.json
 * Derived (stamped):
 *   - CLAUDE.md                                       (Version section "Claude Code: >= X.Y.Z")
 *   - src/hooks/src/lib/cc-version-matrix.ts          (MIN_CC_VERSION constant)
 *   - src/skills/doctor/references/version-compatibility.md  (overview line)
 *
 * Idempotent. Run after editing cc-support.json. Used by:
 *   - .github/workflows/cc-support-window-bump.yml (CI auto-bump)
 *   - manual `node scripts/stamp-cc-support.mjs` invocations
 *
 * Issue: #1488 (M130)
 */
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const supportPath = join(ROOT, 'shared/cc-support.json');
if (!existsSync(supportPath)) {
  console.error(`stamp-cc-support: missing ${supportPath}`);
  process.exit(1);
}
const support = JSON.parse(readFileSync(supportPath, 'utf8'));
const { supported_floor, latest } = support;

if (!supported_floor || !/^\d+\.\d+\.\d+$/.test(supported_floor)) {
  console.error(`stamp-cc-support: invalid supported_floor "${supported_floor}"`);
  process.exit(1);
}

// Monotonic guard. Read the CURRENT MIN_CC_VERSION and refuse to lower it.
// A SoT regression (e.g., manual edit dropping floor below where it is) must
// fail loud, not silently downgrade the support window.
const MATRIX_FILE = 'src/hooks/src/lib/cc-version-matrix.ts';
const MIN_CC_RE = /export const MIN_CC_VERSION = '(\d+\.\d+\.\d+)';/g;

function semverCmp(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

function readCurrentMinCc() {
  const abs = join(ROOT, MATRIX_FILE);
  if (!existsSync(abs)) return null;
  const text = readFileSync(abs, 'utf8');
  const matches = [...text.matchAll(MIN_CC_RE)];
  if (matches.length === 0) {
    console.error(`stamp-cc-support: no MIN_CC_VERSION assignment found in ${MATRIX_FILE}`);
    process.exit(1);
  }
  if (matches.length > 1) {
    console.error(`stamp-cc-support: ${matches.length} MIN_CC_VERSION assignments found in ${MATRIX_FILE} — refusing to stamp ambiguously`);
    process.exit(1);
  }
  return matches[0][1];
}

const currentMinCc = readCurrentMinCc();
if (currentMinCc && semverCmp(supported_floor, currentMinCc) < 0) {
  console.error(`stamp-cc-support: refusing to lower MIN_CC_VERSION from ${currentMinCc} to ${supported_floor}.`);
  console.error('  Set shared/cc-support.json.supported_floor to a value >= the current floor,');
  console.error('  or use shared/cc-support.json.manual_override to suppress the auto-bump workflow.');
  process.exit(1);
}

let mutations = 0;

// Atomic write: tmp + rename. Avoids leaving a truncated source file on crash.
function writeAtomic(abs, content) {
  const tmp = `${abs}.tmp.stamp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, abs);
}

function stamp(filePath, replacers) {
  const abs = join(ROOT, filePath);
  if (!existsSync(abs)) {
    console.warn(`stamp-cc-support: skip (missing): ${filePath}`);
    return;
  }
  const before = readFileSync(abs, 'utf8');
  let after = before;
  for (const { pattern, replacement, label, expectedMatches = 1 } of replacers) {
    // Count matches up-front so we fail loudly on rename / refactor / dup.
    const matchCount = (after.match(pattern.global ? pattern : new RegExp(pattern.source, pattern.flags + 'g')) || []).length;
    if (matchCount !== expectedMatches) {
      console.error(`stamp-cc-support: ${filePath} :: ${label} — expected ${expectedMatches} match(es), found ${matchCount}.`);
      console.error('  The source file may have been renamed, refactored, or contains a duplicate assignment.');
      process.exit(1);
    }
    const next = after.replace(pattern, replacement);
    if (next !== after) {
      console.log(`  ✓ ${filePath} :: ${label}`);
      mutations++;
    }
    after = next;
  }
  if (after !== before) writeAtomic(abs, after);
}

console.log(`stamp-cc-support: floor=${supported_floor} latest=${latest}`);

stamp('CLAUDE.md', [
  {
    label: 'Version section CC floor',
    pattern: /(\*\*Claude Code\*\*:\s*>=\s*)\d+\.\d+\.\d+/,
    replacement: `$1${supported_floor}`,
    expectedMatches: 1,
  },
]);

stamp('src/hooks/src/lib/cc-version-matrix.ts', [
  {
    label: 'MIN_CC_VERSION constant',
    pattern: /(export const MIN_CC_VERSION = ')\d+\.\d+\.\d+(';)/,
    replacement: `$1${supported_floor}$2`,
    expectedMatches: 1,
  },
]);

stamp('src/skills/doctor/references/version-compatibility.md', [
  {
    label: 'Overview line',
    pattern: /(OrchestKit requires Claude Code >= )\d+\.\d+\.\d+\./,
    replacement: `$1${supported_floor}.`,
    expectedMatches: 1,
  },
]);

console.log(mutations === 0
  ? 'stamp-cc-support: no changes needed (already in sync)'
  : `stamp-cc-support: ${mutations} mutation(s) applied`);
