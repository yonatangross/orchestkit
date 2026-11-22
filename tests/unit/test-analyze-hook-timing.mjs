#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/analyze-hook-timing.mjs', import.meta.url));
const home = mkdtempSync(join(tmpdir(), 'hook-timing-test-'));
const dir = join(home, '.claude', 'analytics');
mkdirSync(dir, { recursive: true });
const path = join(dir, 'hook-timing.jsonl');
const fixture = ['alpha', 'beta', 'gamma'].map((hook, i) => JSON.stringify({ hook, duration_ms: 30 - i * 10 })).join('\n');
const run = (args = []) => spawnSync(process.execPath, [script, ...args], {
  env: { ...process.env, HOME: home }, encoding: 'utf8',
});
let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL: ${name}: ${error.message}`);
  }
}

try {
  writeFileSync(path, fixture);
  for (const args of [['--top'], ['--hook'], ['--hook', '--top', '5'], ['--top', '--hook', 'alpha'], ...['abc', '0', '-1', '1.5', '2x', 'Infinity', '', '9007199254740992'].map(value => ['--top', value])]) {
    check(`reject ${JSON.stringify(args)}`, () => {
      const result = run(args);
      assert.notEqual(result.status, 0, 'must exit non-zero');
      assert.match(result.stderr, /--(?:top|hook)/);
      assert.match(result.stderr, /Usage:/);
      assert.equal(result.stdout, '');
    });
  }
  check('valid top and hook filters', () => {
    const top = run(['--top', '2']);
    assert.equal(top.status, 0);
    assert.match(top.stdout, /alpha/);
    assert.match(top.stdout, /beta/);
    assert.doesNotMatch(top.stdout, /gamma/);
    const hook = run(['--hook', 'beta']);
    assert.equal(hook.status, 0);
    assert.match(hook.stdout, /beta/);
    assert.doesNotMatch(hook.stdout, /alpha|gamma/);
  });
  check('skip malformed and non-object records without changing output', () => {
    const clean = run();
    assert.equal(clean.status, 0);
    writeFileSync(path, 'null\n5\n"x"\n[]\n{broken\n{}\n' + fixture);
    const mixed = run();
    assert.equal(mixed.status, 0, mixed.stderr);
    assert.equal(mixed.stdout, clean.stdout.replace('Entries: 3 total', 'Entries: 9 total'));
    assert.equal(mixed.stderr, '');
  });
  check('only invalid records report no valid entries', () => {
    writeFileSync(path, 'null\n5\n"x"\n[]\n{broken\n');
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No valid entries/);
    assert.doesNotMatch(result.stderr, /TypeError/);
  });
  check('empty file retains its diagnostic', () => {
    writeFileSync(path, '');
    const result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is empty/);
  });
} finally {
  rmSync(home, { recursive: true, force: true });
}
console.log(`${failures ? 'FAIL' : 'PASS'}: analyze-hook-timing (${failures} failures)`);
if (failures) process.exit(1);
