#!/usr/bin/env node
// ============================================================================
// The compatibility table: every number per host is generated, never typed
// ============================================================================
// WHAT THIS GUARDS
//
//   README.md and docs/guides/orchestkit-on-pi-codex-cursor.mdx each carry one
//   compatibility table between compat-table markers. scripts/lib/compat-table.js
//   builds it from the pack manifests (through scripts/lib/library-hosts.js),
//   the stamped hooks count and shared/cc-support.json. This test fails when a
//   committed table differs from a fresh build, so a pack that gains or loses a
//   skill cannot leave a typed number behind (the Codex row said 6 while 7
//   shipped, 16.11.2026).
//
//   Also pins: an unknown number renders "?", never 0; the minimum Claude Code
//   version is read, not typed; the hosts and their order are the site's.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { buildCompatRows, renderCompatMarkdown, extractBlock, MARKERS } = require(
  join(root, 'scripts/lib/compat-table.js'),
);

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

const rows = buildCompatRows(root);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const dirs = (p) => readdirSync(join(root, p), { withFileTypes: true }).filter((e) => e.isDirectory()).length;

check('hosts and their order are the site host-installs order', () => {
  const site = readFileSync(join(root, 'docs/site/lib/host-installs.ts'), 'utf8');
  const start = site.indexOf('export const HOST_INSTALLS');
  const block = site.slice(start, site.indexOf('\n];', start));
  const ids = [...block.matchAll(/^\t\tid: "([a-z]+)",$/gm)].map((m) => m[1]);
  assert.deepEqual(rows.map((r) => r.id), ids);
});

check('Claude Code skills = ork + ork-extras skill dirs', () => {
  assert.equal(byId.claude.skills, dirs('plugins/ork/skills') + dirs('plugins/ork-extras/skills'));
});

check('Codex skills = plugins/ork-codex/skills dirs, roles = roles/*.toml', () => {
  assert.equal(byId.codex.skills, dirs('plugins/ork-codex/skills'));
  const roles = readdirSync(join(root, 'plugins/ork-codex/roles')).filter((n) => n.endsWith('.toml')).length;
  assert.equal(byId.codex.roles, roles);
});

check('Claude Code hooks = the stamped hooks count (bin/count-hooks.sh via stamp-counts.sh)', () => {
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const stamped = Number(readme.match(/<!--ork:hooks-->(\d+)<!--\/ork-->/)[1]);
  assert.equal(byId.claude.hooks, stamped);
});

check('minimum Claude Code version is read from shared/cc-support.json', () => {
  const floor = JSON.parse(readFileSync(join(root, 'shared/cc-support.json'), 'utf8')).supported_floor;
  assert.equal(byId.claude.minVersion, floor);
  for (const r of rows.filter((r) => r.id !== 'claude')) assert.equal(r.minVersion, null);
});

check('Devin skills = the skill dirs .devin-plugin/plugin.json declares (claims check 16.11)', () => {
  const manifest = JSON.parse(readFileSync(join(root, '.devin-plugin/plugin.json'), 'utf8'));
  assert.equal(byId.devin.skills, dirs(manifest.skills.replace(/^\.\//, '')));
});

check('an unknown number renders "?", never 0 (Devin agents and hooks are not declared)', () => {
  assert.equal(byId.devin.agents, null);
  const md = renderCompatMarkdown(rows);
  const devinLine = md.split('\n').find((l) => l.startsWith('| Devin '));
  assert.ok(devinLine, 'Devin row missing');
  assert.ok(devinLine.includes('| ? |'), `Devin row should show ?: ${devinLine}`);
  assert.ok(!/\| 0 \|/.test(devinLine), `Devin row must not show 0: ${devinLine}`);
});

check('"none" never appears: unread numbers are ?, tracked gaps are "not yet (#N)" (looks review 16.11)', () => {
  const md = renderCompatMarkdown(rows);
  assert.ok(!/\| none \|/.test(md), 'a cell reads "none"');
  for (const id of ['cursor', 'codex', 'pi']) {
    assert.equal(byId[id].hooks, 'not yet');
    assert.equal(byId[id].hooksIssue, 4004);
  }
  for (const id of ['opencode', 'muse', 'pi', 'agy']) assert.equal(byId[id].agents, null, `${id} agents`);
});

for (const file of ['README.md', 'docs/site/content/docs/guides/orchestkit-on-pi-codex-cursor.mdx']) {
  check(`${file} carries exactly the generated table`, () => {
    const text = readFileSync(join(root, file), 'utf8');
    const block = extractBlock(text, MARKERS[file.endsWith('.mdx') ? 'mdx' : 'md']);
    assert.ok(block !== null, `no compat-table markers in ${file}`);
    assert.equal(block.trim(), renderCompatMarkdown(rows).trim(), `${file} table drifted: run node scripts/stamp-compat-table.js`);
  });
}

check('docs/site/lib/generated/compat-data.ts is the fresh build (stamp --check)', () => {
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [join(root, 'scripts/stamp-compat-table.js'), '--check'], { stdio: 'pipe' });
});

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nall ok');
