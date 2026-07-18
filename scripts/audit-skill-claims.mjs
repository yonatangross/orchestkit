#!/usr/bin/env node
// audit-skill-claims: find forward-looking references to GitHub issues that are
// already CLOSED — i.e. skill/agent prose describing work as pending after it
// shipped. Live catch that motivated this: brainstorm/SKILL.md said "See #1847
// for the migration of ork's existing notification hooks" months after #1847
// closed and the code landed.
//
// Usage: node scripts/audit-skill-claims.mjs [--json]
// Requires: gh CLI authenticated. Exit 1 when stale claims are found.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'yonatangross/orchestkit';

// Phrasing that asserts an issue is still ahead of us. Conservative on
// purpose: plain "#1234" mentions (history, attribution) are fine and ignored.
const FORWARD = new RegExp(
  [
    'see #\\d+ for',
    'tracked in #\\d+',
    'pending #\\d+',
    '#\\d+ (is|remains|stays) (open|pending)',
    'will (be|land|ship|migrate)',
    'not yet (implemented|migrated|adopted|wired|shipped)',
    'planned in #\\d+',
    'once #\\d+ (lands|merges|ships|closes)',
    'when #\\d+ (lands|merges|ships|closes)',
    'blocked (on|by) #\\d+',
  ].join('|'),
  'i',
);

const files = globSync('src/{skills,agents}/**/*.md', { cwd: ROOT });

const candidates = [];
for (const rel of files) {
  const lines = readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!FORWARD.test(line)) return;
    const refs = [...line.matchAll(/#(\d{3,5})\b/g)].map((m) => m[1]);
    if (refs.length === 0) return;
    candidates.push({ file: rel, line: i + 1, refs, excerpt: line.trim().slice(0, 160) });
  });
}

const unique = [...new Set(candidates.flatMap((c) => c.refs))];
const state = {};
for (const n of unique) {
  // Serialized on purpose: parallel gh bursts trip abuse detection.
  try {
    const out = execFileSync(
      'gh',
      ['api', `repos/${REPO}/issues/${n}`, '--jq', '{state: .state, pr: (.pull_request != null)}'],
      { encoding: 'utf8' },
    );
    state[n] = JSON.parse(out);
  } catch {
    state[n] = { state: 'unknown', pr: false };
  }
}

// A forward-looking line is stale when EVERY issue it cites is closed
// (a line citing one open + one closed issue is still legitimately pending).
const stale = candidates.filter((c) =>
  c.refs.every((n) => state[n]?.state === 'closed'),
);

const asJson = process.argv.includes('--json');
if (asJson) {
  console.log(JSON.stringify({ scanned: files.length, candidates: candidates.length, stale }, null, 2));
} else {
  console.log(`audit-skill-claims: ${files.length} files scanned, ${candidates.length} forward-looking issue refs, ${stale.length} stale`);
  for (const s of stale) {
    console.log(`  STALE ${s.file}:${s.line} -> #${s.refs.join(', #')} (closed): ${s.excerpt}`);
  }
}
process.exit(stale.length > 0 ? 1 : 0);
