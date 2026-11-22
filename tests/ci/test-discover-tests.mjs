#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const discover = path.join(root, 'scripts/ci/discover-tests.sh');
const workflow = readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
const invocation = workflow.match(/bash (scripts\/ci\/run-tests\.sh) (tests\/skills) --verbose/);
assert.ok(invocation, 'CI skill runner invocation must be found');
const work = mkdtempSync(path.join(tmpdir(), 'ork-discover-tests.'));
const run = (script, args, cwd = root) => spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8' });
const strip = text => text.replace(/\x1b\[[0-9;]*m/g, '');
try {
  // Mirror names, not bodies: the CI runner selects the roster without running real tests.
  const mirror = dir => {
    mkdirSync(path.join(work, dir), { recursive: true });
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) mirror(name);
      else if (entry.isFile()) writeFileSync(path.join(work, name), entry.name.endsWith('.sh') ? 'exit 0\n' : '');
    }
  };
  mirror(invocation[2]);
  const selected = run(path.join(root, invocation[1]), [invocation[2], '--verbose'], work);
  assert.equal(selected.status, 0, selected.stdout + selected.stderr);
  const expected = [...strip(selected.stdout).matchAll(/^\[RUN\] (.+)$/gm)].map(m => m[1]).sort();
  assert.ok(expected.length > 0, 'CI must select skill tests');
  const listed = run(discover, [invocation[2]]);
  assert.equal(listed.status, 0, listed.stderr);
  const actual = listed.stdout.split('\n').filter(line => line.startsWith(`${invocation[2]}/`)).sort();
  const missing = expected.filter(file => !actual.includes(file));
  assert.equal(missing.length, 0, `missing ${missing.length} CI skill tests:\n${missing.join('\n')}`);
  assert.deepEqual(actual, expected);
  assert.equal(run(discover, [invocation[2], '--count']).stdout.trim(), String(expected.length));
  const categories = run(discover, [invocation[2], '--by-category']);
  assert.equal(categories.status, 0, categories.stderr);
  for (const file of expected) assert.ok(categories.stdout.includes(`  - ${path.basename(file)}\n`));
  const shellOnly = run(discover, [invocation[2], '--pattern', 'test-*.sh', '--count']);
  // The runner treats its default shell pattern as the combined default too.
  assert.equal(shellOnly.stdout.trim(), String(expected.length));
  const nodeOnly = run(discover, [invocation[2], '--pattern', 'test-*.mjs', '--count']);
  assert.equal(nodeOnly.stdout.trim(), String(expected.filter(file => file.endsWith('.mjs')).length));
  mkdirSync(path.join(work, 'empty'));
  assert.equal(run(discover, [path.join(work, 'empty'), '--count']).stdout.trim(), '0');
  assert.equal(run(discover, [path.join(work, 'empty')]).status, 0);
  assert.equal(run(discover, [path.join(work, 'empty'), '--by-category']).status, 0);
  const absent = run(discover, [path.join(work, 'missing')]);
  assert.notEqual(absent.status, 0);
  assert.match(absent.stdout, /Directory not found:/);
  console.log(`PASS: discovery matches all ${expected.length} CI skill tests (${expected.filter(file => file.endsWith('.mjs')).length} node tests)`);
  console.log('PASS: count, categories, patterns, empty and missing directories');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(work, { recursive: true, force: true });
}
