#!/usr/bin/env node
// ============================================================================
// doctor: agent-browser version check (#5289 ask b), offline with a stub binary
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/doctor/scripts/check-agent-browser-version.sh reads
//   `agent-browser --version` and flags a build older than MIN_VERSION, so a
//   desk that is still on 0.27.1 gets a WARN with the upgrade command instead
//   of a silent pass.
//
//   1. The version from the issue (0.27.1) flags, names itself, prints the fix.
//   2. The current release (0.43.0, read from npm 2026-11-18 10:39 IST) is quiet.
//   3. The comparison is numeric (0.9.0 is older than 0.31.x), the floor passes,
//      one patch below it flags.
//   4. A bare version string and an unreadable one: the first is read, the
//      second never flags (a check that cannot prove a problem stays quiet).
//   5. Not installed is optional, never a flag.
//   6. --json gives one object with the verdict.
//   7. One source of truth: MIN_VERSION in the script is the only machine
//      value, and the expect skill's prose floor says the same number.
//
// HOW
//
//   A stub `agent-browser` (a bash script) goes first on PATH. No network, no
//   real agent-browser. Runs the check as `bash <script>`; the path is built
//   from this file's URL, not from a variable the caller sets.
// ============================================================================

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHECK = path.join(REPO, 'src', 'skills', 'doctor', 'scripts', 'check-agent-browser-version.sh');
const EXPECT_SKILL = path.join(REPO, 'src', 'skills', 'expect', 'SKILL.md');

const tmp = mkdtempSync(path.join(tmpdir(), 'ork-ab-ver-'));
process.on('exit', () => rmSync(tmp, { recursive: true, force: true }));

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`  FAIL ${name}\n       ${String(err.message).split('\n').join('\n       ')}`);
  }
}

function makeStub(name, versionLine) {
  const dir = path.join(tmp, name);
  mkdirSync(dir, { recursive: true });
  const bin = path.join(dir, 'agent-browser');
  writeFileSync(bin, `#!/bin/bash\necho "${versionLine}"\n`);
  chmodSync(bin, 0o755);
  return dir;
}

function run(stubDir, args = [], basePath = process.env.PATH) {
  const PATH = stubDir ? `${stubDir}${path.delimiter}${basePath}` : basePath;
  const r = spawnSync('bash', [CHECK, ...args], { env: { ...process.env, PATH }, encoding: 'utf8' });
  return { rc: r.status, out: `${r.stdout}${r.stderr}` };
}

console.log('== agent-browser version check (#5289 b) ==');

if (!existsSync(CHECK)) {
  console.log(`  FAIL check script missing: ${CHECK}`);
  process.exit(1);
}

const MIN = (readFileSync(CHECK, 'utf8').match(/^MIN_VERSION="(\d+\.\d+\.\d+)"/m) || [])[1];

check('MIN_VERSION is declared once, as MIN_VERSION="x.y.z"', () => {
  assert.ok(MIN, 'no MIN_VERSION="x.y.z" line in the check script');
  const hits = readFileSync(CHECK, 'utf8').match(/^MIN_VERSION=/gm) || [];
  assert.equal(hits.length, 1);
});

check('0.27.1 flags with WARN, the version and the upgrade command', () => {
  const { rc, out } = run(makeStub('old', 'agent-browser 0.27.1'));
  assert.equal(rc, 1, out);
  assert.match(out, /WARN/);
  assert.match(out, /0\.27\.1/);
  assert.match(out, /npm install -g agent-browser@latest/);
});

check('0.43.0 (current release) is quiet', () => {
  const { rc, out } = run(makeStub('current', 'agent-browser 0.43.0'));
  assert.equal(rc, 0, out);
  assert.doesNotMatch(out, /WARN/);
});

check('numeric compare: 0.9.0 is older than the floor', () => {
  const { rc, out } = run(makeStub('nine', 'agent-browser 0.9.0'));
  assert.equal(rc, 1, out);
});

check('the floor passes and one patch below it flags', () => {
  assert.ok(MIN);
  const [mj, mn, pt] = MIN.split('.').map(Number);
  assert.equal(run(makeStub('floor', `agent-browser ${MIN}`)).rc, 0);
  assert.ok(pt > 0, 'floor patch is 0, extend this case to step the minor');
  assert.equal(run(makeStub('below', `agent-browser ${mj}.${mn}.${pt - 1}`)).rc, 1);
});

check('a bare version string is read', () => {
  assert.equal(run(makeStub('bare', '0.27.1')).rc, 1);
});

check('an unreadable version never flags and says UNKNOWN', () => {
  const { rc, out } = run(makeStub('junk', 'something unexpected'));
  assert.equal(rc, 0, out);
  assert.match(out, /UNKNOWN/);
});

check('not installed is optional, never a flag', () => {
  const empty = path.join(tmp, 'empty-bin');
  mkdirSync(empty, { recursive: true });
  const { rc, out } = run(null, [], `${empty}${path.delimiter}/usr/bin${path.delimiter}/bin`);
  if (/NOT INSTALLED/.test(out)) {
    assert.equal(rc, 0, out);
  } else {
    console.log('       (skipped: an agent-browser exists in /usr/bin:/bin on this host)');
  }
});

check('--json gives one object with verdict and installed', () => {
  const { rc, out } = run(makeStub('old-json', 'agent-browser 0.27.1'), ['--json']);
  assert.equal(rc, 1, out);
  const obj = JSON.parse(out.trim());
  assert.equal(obj.verdict, 'OUTDATED');
  assert.equal(obj.installed, '0.27.1');
  assert.equal(obj.minimum, MIN);
});

check('expect SKILL.md prose floor equals MIN_VERSION', () => {
  assert.ok(MIN);
  const text = readFileSync(EXPECT_SKILL, 'utf8');
  assert.ok(text.includes(`Floor is \`>= ${MIN}\``), `expect SKILL.md does not say "Floor is \`>= ${MIN}\`"`);
});

console.log(`== ${pass} passed, ${fail} failed ==`);
process.exit(fail === 0 ? 0 : 1);
