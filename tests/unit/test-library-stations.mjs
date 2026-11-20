#!/usr/bin/env node
// ============================================================================
// library-data.ts: every skill, agent and hook sits at exactly one workflow station
// ============================================================================
// WHAT THIS GUARDS
//
//   The home page library shows every item at the station where it acts (Ask, Plan, Build,
//   Guard, Check, Ship, Remember). scripts/lib/library-stations.js holds the rules and
//   scripts/generate-docs-data.js writes docs/site/lib/generated/library-data.ts.
//
//   The site's TOTALS.hooks counts hooks.json handlers PLUS hook handlers declared inside
//   skills (and agents). The library lists the hooks.json handlers as items and keeps the
//   skill-scoped ones with their skill, so its hook count is lower than TOTALS.hooks on
//   purpose. This test pins that sum, so the two numbers can never drift apart unexplained.
//
//   Checks: the committed file is complete and consistent; the sum against TOTALS; a new hook
//   event with no station fails the build; no station rule names a skill or agent that is gone;
//   the generator still builds on a partial fixture tree.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { buildLibrary, listHooks, stalePlacements, STATIONS } = require(join(root, 'scripts/lib/library-stations.js'));
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL - ${name}\n  ${err.message.split('\n').join('\n  ')}`);
  }
}

/** Read `export const NAME: Type = <json>;` out of a generated TS file. */
function generatedConst(file, name) {
  const text = readFileSync(join(root, 'docs/site/lib/generated', file), 'utf8');
  const match = text.match(new RegExp(`export const ${name}: [^=]+= ([\\s\\S]*?);\\n(?:\\n|$)`));
  assert.ok(match, `${name} not found in ${file}`);
  return JSON.parse(match[1]);
}

const items = generatedConst('library-data.ts', 'LIBRARY_ITEMS');
const counts = generatedConst('library-data.ts', 'LIBRARY_COUNTS');
const stations = generatedConst('library-data.ts', 'LIBRARY_STATIONS');
const totals = generatedConst('shared-data.ts', 'TOTALS');
const keys = new Set(STATIONS.map((s) => s.key));

check('every item has exactly one of the 7 stations and a unique id', () => {
  assert.equal(keys.size, 7);
  for (const i of items) assert.ok(keys.has(i.station), `${i.id} has station ${i.station}`);
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, 'duplicate ids');
});

check('counts match the items, and station counts add up to every item', () => {
  const kind = (k) => items.filter((i) => i.kind === k).length;
  assert.deepEqual(
    { items: counts.items, skills: counts.skills, agents: counts.agents, hooks: counts.hooks },
    { items: items.length, skills: kind('skill'), agents: kind('agent'), hooks: kind('hook') },
  );
  const sum = stations.reduce((n, s) => n + s.skills + s.agents + s.hooks, 0);
  assert.equal(sum, items.length);
});

check('every skill and agent the site counts is in the library', () => {
  assert.equal(counts.skills, totals.skills);
  assert.equal(counts.agents, totals.agents);
});

check('library hooks + skill-scoped handlers == TOTALS.hooks (no agent declares hooks today)', () => {
  const scopedOnSkills = items.filter((i) => i.kind === 'skill').reduce((n, i) => n + i.scopedHooks, 0);
  assert.equal(scopedOnSkills, counts.skillScopedHooks);
  assert.equal(counts.hooks + counts.skillScopedHooks, totals.hooks,
    `${counts.hooks} hooks + ${counts.skillScopedHooks} skill-scoped != TOTALS.hooks ${totals.hooks}`);
});

check('the hook items are exactly the hooks.json handlers', () => {
  const hooksJson = JSON.parse(readFileSync(join(root, 'src/hooks/hooks.json'), 'utf8'));
  const fromFile = listHooks(hooksJson).map((h) => `hook:${h.event}:${h.matcher}:${h.script}`).sort();
  const fromData = items.filter((i) => i.kind === 'hook').map((i) => i.id).sort();
  assert.deepEqual(fromData, fromFile);
});

check('a hook event with no station fails the build (never a silent default)', () => {
  assert.throws(
    () => buildLibrary({ skills: {}, agents: {}, hooks: [{ event: 'BrandNewEvent', matcher: '', script: 'x/y', name: 'y' }] }),
    /BrandNewEvent.*has no station/,
  );
});

check('every skill and agent named in a station rule exists in the real tree', () => {
  const names = (k) => items.filter((i) => i.kind === k).map((i) => i.name);
  assert.deepEqual(stalePlacements(names('skill'), names('agent')), []);
  assert.deepEqual(stalePlacements([], []).length > 0, true, 'the stale check must be able to fail');
});

check('the generator still builds on a partial tree (fixture tests run it on one skill)', () => {
  const lib = buildLibrary({ skills: { commit: { description: 'x' } }, agents: {}, hooks: [] });
  assert.equal(lib.items.length, 1);
  assert.equal(lib.items[0].station, 'ship');
});

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall library-stations checks passed');
