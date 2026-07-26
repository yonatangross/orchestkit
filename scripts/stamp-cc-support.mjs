#!/usr/bin/env node
/**
 * stamp-cc-support.mjs — propagate shared/cc-support.json values into derived files.
 *
 * Single source of truth: shared/cc-support.json
 * Derived (stamped):
 *   - CLAUDE.md                                       (Version section "Claude Code: >= X.Y.Z")
 *   - src/hooks/src/lib/cc-version-matrix.ts          (MIN_CC_VERSION + LATEST_KNOWN_CC constants)
 *   - src/skills/doctor/references/version-compatibility.md  (overview line)
 *   - docs/site/content/docs/troubleshooting/index.mdx (fenced code-block floor comment)
 *   - README.md                                       (shields.io badge + "Requires >=" prose)
 *   - src/skills/<slug>/SKILL.md                      (compatibility: frontmatter floor, all 114)
 *     (written with <slug> deliberately: the literal glob would close this
 *     block comment on its own "*" + "/" and silently turn the rest of the
 *     header into parsed code.)
 *
 * The SKILL.md sweep was added 2026-07-25. Before it, those 114 floors were
 * hand-edited on every bump while tests/manifests/test-cc-version-floor.sh
 * enforced them against the SoT with SKILL_COMPAT_STRICT defaulting to 1 — so a
 * floor bump was a guaranteed 114-file CI failure until someone did the sweep by
 * hand. Only the "Claude Code X.Y.Z+" prefix is rewritten; the remainder of each
 * compatibility string is preserved verbatim, because 31 of the 114 also state
 * real per-skill dependencies (memory MCP server, gh CLI, network access,
 * agent-browser >= 0.25.0, optional stitch / 21st-dev-magic / storybook-mcp).
 *
 * Idempotent. Run after editing cc-support.json. Used by:
 *   - .github/workflows/cc-support-window-bump.yml (CI auto-bump)
 *   - manual `node scripts/stamp-cc-support.mjs` invocations
 *
 * Issue: #1488 (M130)
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  readdirSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const supportPath = join(ROOT, 'shared/cc-support.json');
if (!existsSync(supportPath)) {
  console.error(`stamp-cc-support: missing ${supportPath}`);
  process.exit(1);
}
const support = JSON.parse(readFileSync(supportPath, 'utf8'));
const { supported_floor, latest, latest_known } = support;

if (!supported_floor || !/^\d+\.\d+\.\d+$/.test(supported_floor)) {
  console.error(`stamp-cc-support: invalid supported_floor "${supported_floor}"`);
  process.exit(1);
}

// `latest_known` (the highest CC version ork's adoption covers) stamps LATEST_KNOWN_CC,
// the version-check adoption-nudge threshold. Distinct from `latest` (the support-window
// head) — they diverge while a manual_override freezes the floor. Must be >= the floor.
if (!latest_known || !/^\d+\.\d+\.\d+$/.test(latest_known)) {
  console.error(`stamp-cc-support: invalid latest_known "${latest_known}"`);
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

console.log(`stamp-cc-support: floor=${supported_floor} latest=${latest} latest_known=${latest_known}`);

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
  {
    label: 'LATEST_KNOWN_CC constant',
    pattern: /(export const LATEST_KNOWN_CC = ')\d+\.\d+\.\d+(';)/,
    replacement: `$1${latest_known}$2`,
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

stamp('docs/site/content/docs/troubleshooting/index.mdx', [
  {
    // Fenced code block — prose in docs uses <MinCC /> from @/components/count,
    // but code blocks can't interpolate, so this literal is stamped instead.
    label: 'code-block floor comment',
    pattern: /(# Check Claude Code version \(requires >= )\d+\.\d+\.\d+(\))/,
    replacement: `$1${supported_floor}$2`,
    expectedMatches: 1,
  },
]);

// The marketplace engine field is the machine-readable install gate: CC refuses
// to install the plugin below it. It was hand-maintained and untested, so it
// drifted twice (2.1.113 -> 2.1.148 in #2116, then 2.1.148 while the floor moved
// to 2.1.220). Stamping it removes the hand-maintenance that caused both.
stamp('.claude-plugin/marketplace.json', [
  {
    label: 'marketplace engine floor',
    pattern: /("engine":\s*">=)\d+\.\d+\.\d+(")/,
    replacement: `$1${supported_floor}$2`,
    expectedMatches: 1,
  },
]);

stamp('README.md', [
  {
    label: 'Claude Code shields.io badge floor',
    pattern: /(Claude_Code-≥)\d+\.\d+\.\d+/,
    replacement: `$1${supported_floor}`,
    expectedMatches: 1,
  },
  {
    label: 'Requires floor prose',
    pattern: /(Requires \*\*≥)\d+\.\d+\.\d+(\*\*)/,
    replacement: `$1${supported_floor}$2`,
    expectedMatches: 1,
  },
]);

// ---------------------------------------------------------------------------
// src/skills/*/SKILL.md :: compatibility: frontmatter floor
//
// Not a `stamp()` call because the target is ~114 files rather than one, and a
// per-file expectedMatches assertion would be the wrong contract: a skill is
// allowed to carry no compatibility line at all. Instead this reports three
// counts and fails loud only on the one case that indicates real drift — a
// compatibility line whose floor cannot be parsed.
// ---------------------------------------------------------------------------
const SKILLS_DIR = 'src/skills';
// Anchored to the frontmatter line so body prose that legitimately cites an old
// release (matrix rows, "CC 2.1.206 introduced X") is never touched.
const COMPAT_LINE_RE = /^(compatibility:\s*"?)Claude Code (\d+\.\d+\.\d+)\+/m;

function stampSkillCompatibility() {
  const absSkills = join(ROOT, SKILLS_DIR);
  if (!existsSync(absSkills)) {
    console.warn(`stamp-cc-support: skip (missing): ${SKILLS_DIR}`);
    return;
  }

  let stamped = 0;
  let inSync = 0;
  let noFloor = 0;
  const unparseable = [];

  const dirs = readdirSync(absSkills, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  for (const dir of dirs) {
    const rel = `${SKILLS_DIR}/${dir}/SKILL.md`;
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;

    const before = readFileSync(abs, 'utf8');
    const compatLine = before.match(/^compatibility:.*$/m);
    if (!compatLine) {
      noFloor++;
      continue;
    }

    const m = before.match(COMPAT_LINE_RE);
    if (!m) {
      // Declares compatibility but not in the "Claude Code X.Y.Z+" shape this
      // stamper owns. Collected and reported rather than silently skipped, so a
      // reworded floor can't drift away from the SoT unnoticed.
      unparseable.push(`${rel}: ${compatLine[0].slice(0, 90)}`);
      continue;
    }

    if (m[2] === supported_floor) {
      inSync++;
      continue;
    }

    const after = before.replace(
      COMPAT_LINE_RE,
      `$1Claude Code ${supported_floor}+`,
    );
    writeAtomic(abs, after);
    stamped++;
    mutations++;
  }

  if (unparseable.length > 0) {
    console.error(
      `stamp-cc-support: ${unparseable.length} SKILL.md compatibility line(s) declare a floor this stamper cannot parse:`,
    );
    for (const u of unparseable) console.error(`  - ${u}`);
    console.error(
      '  Expected the form: compatibility: "Claude Code X.Y.Z+ ...". Reword to match, or',
    );
    console.error(
      '  drop the CC floor from the line and let the plugin-level declaration stand alone.',
    );
    process.exit(1);
  }

  const total = stamped + inSync + noFloor;
  if (stamped > 0) {
    console.log(
      `  ✓ ${SKILLS_DIR}/*/SKILL.md :: compatibility floor — stamped ${stamped}, already in sync ${inSync}, no floor declared ${noFloor} (of ${total})`,
    );
  } else {
    console.log(
      `  · ${SKILLS_DIR}/*/SKILL.md :: compatibility floor — all ${inSync} in sync at ${supported_floor} (no floor declared: ${noFloor})`,
    );
  }
}

stampSkillCompatibility();

console.log(mutations === 0
  ? 'stamp-cc-support: no changes needed (already in sync)'
  : `stamp-cc-support: ${mutations} mutation(s) applied`);
