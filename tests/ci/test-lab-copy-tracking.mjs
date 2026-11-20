#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, resolvePaths } from '../../docs/site/scripts/lab-manifest.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const workflow = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
const step = workflow.match(/name: Check for uncommitted build changes\n        run: \|\n((?:          .*\n|\n)+)/);
assert.ok(step, 'CI must retain the executable build drift check');
const script = step[1].split('\n').map((line) => line.slice(10)).join('\n');
const fixture = mkdtempSync(join(tmpdir(), 'ork-lab-tracking-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const git = (...args) => execFileSync('git', args, { cwd: fixture, env, stdio: 'pipe' });
const run = (body = script) => spawnSync('bash', ['-e', '-c', body], { cwd: fixture, env, encoding: 'utf8' });
const put = (file, text) => {
  mkdirSync(dirname(join(fixture, file)), { recursive: true });
  writeFileSync(join(fixture, file), text);
};

try {
  git('init', '-q');
  put('plugins/marker', 'fixture');
  put('README.md', 'fixture');
  put('plugin.json', '{}');
  put('docs/page.html', '<html><head><title>Fixture</title></head><body>Lab</body></html>');
  put('docs/site/lab-manifest/fixture.json', JSON.stringify({ slug: 'fixture', source: 'docs/page.html', date: '2026-09-26' }));
  generate(resolvePaths(fixture));
  git('add', '.');
  assert.equal(run().status, 0, 'tracked generated copies pass');

  git('rm', '-q', '-f', 'docs/site/public/lab/fixture.html');
  generate(resolvePaths(fixture));
  const missing = run();
  assert.equal(missing.status, 1, missing.stdout + missing.stderr);
  assert.match(missing.stdout, /Untracked Lab copies/);
  assert.match(missing.stdout, /fixture\.html/);

  const mutant = script.replace(
    /if \[ -n "\$\(git ls-files -o docs\/site\/public\/lab\/\)" \]; then[\s\S]*?\nfi/,
    ':',
  );
  assert.notEqual(mutant, script, 'mutation removes the tracking guard');
  assert.equal(run(mutant).status, 0, 'removing the guard reproduces the original false pass');

  git('add', 'docs/site/public/lab/fixture.html');
  assert.equal(run().status, 0, 'adding the generated copy resolves the failure');
  put('docs/site/public/lab/fixture.html', 'stale');
  assert.equal(run().status, 1, 'tracked content drift still fails');
  console.log('Lab copy tracking: 5 passed, 0 failed; guard mutation reproduced');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
