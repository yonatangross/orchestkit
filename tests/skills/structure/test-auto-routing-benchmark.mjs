#!/usr/bin/env node
// ============================================================================
// ork:auto routing benchmark stays consistent with the routing table
// ============================================================================
// routing-benchmark.json is graded by the paid bare-eval harness, so a broken
// case (a category the table does not have, a route to a skill that does not
// exist) only shows up when someone pays for a run. This static gate catches
// it for free.
//
// Fails if:
//   - a case id repeats, or a case lacks id, goal, category or route
//   - a case category is not an intent in the SKILL.md table (or fallback)
//   - a /ork:<skill> route names a skill with no src/skills/<skill>/SKILL.md
//   - a /ork:<skill> route is not the target the table gives that category
//     (only for categories with a single /ork: target)
//   - setup or migrate has fewer than 3 cases, or loses its /ork:setup or
//     /ork:swarm-migrate route (#4981: both route through ork:auto now)
//
// Usage: node tests/skills/structure/test-auto-routing-benchmark.mjs
// ============================================================================

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const AUTO = path.join(ROOT, 'src', 'skills', 'auto');
const skill = readFileSync(path.join(AUTO, 'SKILL.md'), 'utf8');
const bench = JSON.parse(readFileSync(path.join(AUTO, 'routing-benchmark.json'), 'utf8'));

// Parse the "Intent categories" table: | **intent** | signals | routes to |
const table = new Map();
for (const line of skill.split('\n')) {
  const m = /^\|\s*\*\*([a-z0-9-]+)\*\*\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/.exec(line);
  if (!m) continue;
  const targets = [...m[2].matchAll(/`\/?(?:ork:)?([a-z0-9-]+)[^`]*`/g)].map((t) => t[1]);
  table.set(m[1], targets);
}

const failures = [];
if (table.size < 5) failures.push(`parsed only ${table.size} intents from the SKILL.md table; the parser is broken`);

const ids = new Set();
const perCategory = new Map();
for (const c of bench.cases || []) {
  for (const k of ['id', 'goal', 'category', 'route']) {
    if (!c[k]) failures.push(`case ${c.id ?? '?'}: missing ${k}`);
  }
  if (ids.has(c.id)) failures.push(`case ${c.id}: duplicate id`);
  ids.add(c.id);
  perCategory.set(c.category, [...(perCategory.get(c.category) || []), c]);

  if (c.category !== 'fallback' && !table.has(c.category)) {
    failures.push(`case ${c.id}: category "${c.category}" is not an intent in the SKILL.md table`);
  }
  const r = /^\/ork:([a-z0-9-]+)$/.exec(c.route || '');
  if (r) {
    if (!existsSync(path.join(ROOT, 'src', 'skills', r[1], 'SKILL.md'))) {
      failures.push(`case ${c.id}: route ${c.route} names no skill under src/skills`);
    }
    const targets = table.get(c.category) || [];
    if (targets.length === 1 && targets[0] !== r[1]) {
      failures.push(`case ${c.id}: route ${c.route} but the table routes ${c.category} to ${targets[0]}`);
    }
  }
}

for (const [category, route] of [['setup', '/ork:setup'], ['migrate', '/ork:swarm-migrate']]) {
  const cases = perCategory.get(category) || [];
  if (cases.length < 3) failures.push(`${category}: ${cases.length} benchmark cases, need at least 3 (#4981)`);
  if (cases.some((c) => c.route !== route)) failures.push(`${category}: every case must route to ${route}`);
  if (!skill.includes(`\`${route}\``)) failures.push(`SKILL.md table lost the ${route} route (#4981)`);
}

// Quality loop round 2: SKILL.md said "50 labeled" pairs while the file held 78.
// Every "<N> labeled" count in SKILL.md must equal the real case count.
const caseCount = (bench.cases || []).length;
for (const m of skill.matchAll(/\b(\d+) labeled\b/g)) {
  if (Number(m[1]) !== caseCount) failures.push(`SKILL.md says "${m[0]}" but routing-benchmark.json has ${caseCount} cases`);
}

for (const f of failures) console.log(`FAIL: ${f}`);
if (failures.length) process.exit(1);
console.log(`PASS: ${ids.size} benchmark cases across ${perCategory.size} categories match the ${table.size}-intent routing table`);
