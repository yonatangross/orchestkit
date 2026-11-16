#!/usr/bin/env node
// ============================================================================
// library-data.ts LIBRARY_HOSTS: the per-host numbers on the home page match the manifests
// ============================================================================
// WHAT THIS GUARDS
//
//   The library's per-host line and its "on: <hosts>" marks come from LIBRARY_HOSTS in
//   docs/site/lib/generated/library-data.ts, which scripts/lib/library-hosts.js builds from
//   .cursor-plugin, plugins/ork-codex, package.json (pi) and the skills.sh starter list.
//   This test re-reads those manifests and fails when a shown number differs, so a pack that
//   gains or loses a skill cannot leave the page saying something false.
//
//   Also pins: Devin stays unverified (null sets) until a real read; the codex pack still maps
//   to ork-<name> skills; every skill or agent a host claims exists in the library.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { buildLibraryHosts } = require(join(root, 'scripts/lib/library-hosts.js'));

let failed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`not ok - ${name}\n  ${err.message}`);
  }
}

const src = readFileSync(join(root, 'docs/site/lib/generated/library-data.ts'), 'utf8');
const committed = JSON.parse(src.match(/export const LIBRARY_HOSTS[^=]*= (\{[\s\S]*?\n\});/)[1]);
const items = JSON.parse(src.match(/export const LIBRARY_ITEMS[^=]*= (\[[\s\S]*?\n\]);/)[1]);
const fresh = buildLibraryHosts(root);

check('the committed LIBRARY_HOSTS equals what the manifests say now', () => {
  assert.deepEqual(committed, JSON.parse(JSON.stringify(fresh)));
});

check('Devin is not shown: its sets are null until one real read verifies them', () => {
  assert.equal(committed.devin.skills, null);
  assert.equal(committed.devin.agents, null);
});

check('codex ships skills as ork-<name> and four roles', () => {
  assert.ok(committed.codex.skills.includes('implement'));
  assert.equal(committed.codex.roles.length, 4);
});

check('every skill or agent a host claims is a library item', () => {
  const skills = new Set(items.filter((i) => i.kind === 'skill').map((i) => i.name));
  const agents = new Set(items.filter((i) => i.kind === 'agent').map((i) => i.name));
  for (const [host, sets] of Object.entries(committed)) {
    for (const s of Array.isArray(sets.skills) ? sets.skills : []) {
      if (host === 'codex' || host === 'pi') continue; // codex: ork-<name> aliases; pi: reads the pack dir
      assert.ok(skills.has(s), `${host} claims skill ${s} which the library does not list`);
    }
    for (const a of Array.isArray(sets.agents) ? sets.agents : []) {
      assert.ok(agents.has(a), `${host} claims agent ${a} which the library does not list`);
    }
  }
});

check('the generator builds on a partial tree (no manifests): empty sets, no throw', () => {
  const empty = buildLibraryHosts(join(root, 'does-not-exist'));
  assert.deepEqual(empty.cursor.skills, []);
  assert.equal(empty.devin.skills, null);
});

console.log(failed === 0 ? 'all ok' : `${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
