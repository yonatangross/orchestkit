#!/usr/bin/env node
// ============================================================================
// Agent No-Version-Snapshot Linter  (issue #2600, approach A)
// ============================================================================
// WHAT IT GUARDS
//   Agents (`src/agents/*.md`) have NO pin mechanism. Unlike skills — which
//   carry an `upstream-version-tested:` frontmatter pin that the
//   `labs-version-watch` bot bumps automatically — an agent that hardcodes a
//   Vercel-Labs-package version (agent-browser, emulate, portless, json-render)
//   simply ROTS. The number it snapshotted drifts further from upstream every
//   release, and nothing ever rewrites it. Users then read stale instructions
//   ("agent-browser v0.16 does X") that no longer reflect the installed CLI.
//
//   The fix (approach A): agents must NOT snapshot upstream versions at all.
//   They must reference the SKILL (browser-tools / emulate-seed / portless /
//   json-render-catalog) instead. The SKILL is the single source of truth — it
//   alone carries the `upstream-version-tested:` pin, and it alone is allowed to
//   name a concrete 0.x version, because that pin is bot-maintained. An agent
//   that says "see the browser-tools skill" never rots; an agent that says
//   "(v0.16)" does.
//
//   This linter FAILS CI when any authored `src/agents/*.md` line hardcodes a
//   Labs-version snapshot. It is the AGENTS half of the version-rot defense;
//   its sibling, test-upstream-version-drift.mjs, is the SKILLS half (it checks
//   that a skill's BODY caught up to its bot-maintained pin). Together: skills
//   may name versions (pinned + watched), agents may not (no pin = no claim).
//
// ALGORITHM (see issue #2600 for the canonical spec)
//   - Read every `*.md` DIRECTLY in <dir> (one level, not recursive).
//   - Skip README.md — it is GENERATED from agent descriptions, not authored,
//     so an offense there is a source problem in some description, not here.
//   - For each line, flag it as an OFFENSE when it matches EITHER:
//       (a) a parenthetical version tag  /\(v0\.\d+/   e.g. "(v0.13)",
//           "(v0.15-v0.29)" — the agent-browser feature-tag anti-pattern, or
//       (b) a Labs package name adjacent to a version on the same line:
//             (agent-browser|emulate|portless|@?json-render) … v?0.\d+   OR
//             v?0.\d+ … (agent-browser|emulate|portless)
//           (within 40 chars, so "agent-browser v0.16" / "emulate (v0.7+)" hit
//           but an unrelated 0.x elsewhere on a long line does not).
//   - Collect every offense as {file, line, text} and report it.
//   - Exit 1 if any offense, exit 0 (with a SUCCESS line) otherwise.
//
// USAGE
//   node tests/skills/structure/test-agent-no-version-snapshot.mjs
//   node tests/skills/structure/test-agent-no-version-snapshot.mjs --dir <path>
//   Exit 0 = all agents clean, exit 1 = at least one version snapshot.
// ============================================================================

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// tests/skills/structure -> repo root is three levels up.
const REPO_ROOT = join(__dirname, '..', '..', '..');

// ----------------------------------------------------------------------------
// CLI: optional `--dir <path>`, default <repoRoot>/src/agents
// ----------------------------------------------------------------------------
function parseDir(argv) {
  const i = argv.indexOf('--dir');
  if (i !== -1 && argv[i + 1]) return argv[i + 1];
  return join(REPO_ROOT, 'src', 'agents');
}

const AGENTS_DIR = parseDir(process.argv.slice(2));

// ----------------------------------------------------------------------------
// Glob every `*.md` directly in <dir> (one level deep), skipping README.md
// (GENERATED from agent descriptions, not authored).
// ----------------------------------------------------------------------------
function findAgentFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name === 'README.md') continue; // generated, not authored
    const candidate = join(dir, entry.name);
    try {
      if (statSync(candidate).isFile()) files.push(candidate);
    } catch {
      // race: vanished between readdir and stat — skip
    }
  }
  return files.sort();
}

// ----------------------------------------------------------------------------
// Offense detectors — the Labs-version-snapshot anti-pattern.
//
//   (a) PARENTHETICAL_RE: a `(v0.<minor>...` tag, the agent-browser feature-tag
//       format. Matches "(v0.13)", "(v0.15-v0.29)", "(v0.16+)", etc.
//   (b) PKG_BEFORE_RE / PKG_AFTER_RE: a Labs package name within 40 chars of a
//       0.x version on the SAME line, in either order.
//
// Both are tested per-line so the offense report can cite a line number, and so
// the 40-char proximity window in (b) can't reach across an unrelated version
// elsewhere in the file.
// ----------------------------------------------------------------------------
const PARENTHETICAL_RE = /\(v0\.\d+/;
const PKG_BEFORE_RE = /(agent-browser|emulate|portless|@?json-render)[^\n]{0,40}v?0\.\d+/;
const PKG_AFTER_RE = /v?0\.\d+[^\n]{0,40}(agent-browser|emulate|portless)/;

function isOffendingLine(line) {
  return PARENTHETICAL_RE.test(line) || PKG_BEFORE_RE.test(line) || PKG_AFTER_RE.test(line);
}

// ----------------------------------------------------------------------------
// Header
// ----------------------------------------------------------------------------
console.log('============================================================================');
console.log('  Agent No-Version-Snapshot Linter');
console.log('============================================================================');
console.log('');
console.log(`Agents directory: ${AGENTS_DIR}`);
console.log('Agents must reference the SKILL (browser-tools / emulate-seed), never');
console.log('snapshot a Labs-package version — only the skill carries the bot-maintained');
console.log('upstream-version-tested pin. Complements test-upstream-version-drift.mjs');
console.log('(the SKILLS half); this is the AGENTS half.');
console.log('');

// ----------------------------------------------------------------------------
// Scan
// ----------------------------------------------------------------------------
const agentFiles = findAgentFiles(AGENTS_DIR);

let passCount = 0;
const offenses = [];

for (const file of agentFiles) {
  const name = basename(file);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = text.split('\n');
  let fileHasOffense = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isOffendingLine(line)) {
      fileHasOffense = true;
      offenses.push({ file: name, line: i + 1, text: line.trim() });
    }
  }
  if (!fileHasOffense) passCount++;
}

// ----------------------------------------------------------------------------
// Report
// ----------------------------------------------------------------------------
if (offenses.length > 0) {
  console.log('Hardcoded Labs-version snapshots (reference the skill instead):');
  console.log('────────────────────────────────────────────────────────────────────────────');
  for (const o of offenses) {
    console.log(`OFFENSE  ${o.file}:${o.line}  ${o.text}`);
  }
  console.log('');
}

console.log('============================================================================');
console.log(`  Passed: ${passCount} agents  Offenses: ${offenses.length}`);
console.log('============================================================================');

if (offenses.length > 0) {
  console.log('FAILED: at least one agent hardcodes a Labs-package version snapshot');
  console.log('Fix: drop the (v0.x) tag and reference the skill (browser-tools /');
  console.log('emulate-seed / portless / json-render-catalog) — the skill owns the pin.');
  process.exit(1);
} else {
  console.log('SUCCESS: no agent hardcodes a Labs-package version snapshot');
  process.exit(0);
}
