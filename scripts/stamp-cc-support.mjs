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
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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

let mutations = 0;

function stamp(filePath, replacers) {
  const abs = join(ROOT, filePath);
  if (!existsSync(abs)) {
    console.warn(`stamp-cc-support: skip (missing): ${filePath}`);
    return;
  }
  const before = readFileSync(abs, 'utf8');
  let after = before;
  for (const { pattern, replacement, label } of replacers) {
    const next = after.replace(pattern, replacement);
    if (next !== after) {
      console.log(`  ✓ ${filePath} :: ${label}`);
      mutations++;
    }
    after = next;
  }
  if (after !== before) writeFileSync(abs, after);
}

console.log(`stamp-cc-support: floor=${supported_floor} latest=${latest}`);

stamp('CLAUDE.md', [
  {
    label: 'Version section CC floor',
    pattern: /(\*\*Claude Code\*\*:\s*>=\s*)\d+\.\d+\.\d+/,
    replacement: `$1${supported_floor}`,
  },
]);

stamp('src/hooks/src/lib/cc-version-matrix.ts', [
  {
    label: 'MIN_CC_VERSION constant',
    pattern: /(export const MIN_CC_VERSION = ')\d+\.\d+\.\d+(';)/,
    replacement: `$1${supported_floor}$2`,
  },
]);

stamp('src/skills/doctor/references/version-compatibility.md', [
  {
    label: 'Overview line',
    pattern: /(OrchestKit requires Claude Code >= )\d+\.\d+\.\d+\./,
    replacement: `$1${supported_floor}.`,
  },
]);

console.log(mutations === 0
  ? 'stamp-cc-support: no changes needed (already in sync)'
  : `stamp-cc-support: ${mutations} mutation(s) applied`);
