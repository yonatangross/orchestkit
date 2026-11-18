#!/usr/bin/env node
// ============================================================================
// design-to-code ship mode: `gh pr create` survives a quote in the title
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/design-to-code/references/ship-mode.md used to build
//   `gh pr create --title '{pr_title}' --body @- <<< '{pr_body}'`. A title or
//   body holding a quote ended the quote early and the rest ran as shell. The
//   reference now writes the body to a file and builds the command with a
//   named helper, pr_create_cmd, that shell-quotes the title as one word.
//
//   1. The doc no longer carries the quoted-placeholder form or `--body @-`.
//   2. The helper block is extracted from the doc and run with python3, and the
//      command it builds is run by sh against a stub `gh` that records its argv.
//      The title holds a single quote, a double quote, a $( ) and a backtick;
//      the body path holds a space. The stub must see exactly 8 arguments, the
//      title and path byte for byte, and no command inside the title may run.
//   3. Control: the OLD command shape, built the same way, fails case 2.
// ============================================================================

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// SHIP_MODE_DOC=<path> runs the suite against another copy of the doc (the red-first run).
const DOC = readFileSync(process.env.SHIP_MODE_DOC || path.join(REPO, 'src/skills/design-to-code/references/ship-mode.md'), 'utf8');

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(e && e.message).split('\n').join('\n       ')}`);
  }
}

const tmp = mkdtempSync(path.join(tmpdir(), 'shipmode-'));
const bin = path.join(tmp, 'bin');
mkdirSync(bin);
const argvLog = path.join(tmp, 'argv.txt');
writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\n: > "${argvLog}"\nfor a in "$@"; do printf '%s\\0' "$a" >> "${argvLog}"; done\n`);
chmodSync(path.join(bin, 'gh'), 0o755);

const TITLE = `O'Brien's "card" $(touch ${tmp}/PWN) \`touch ${tmp}/PWN2\``;
const BODY_PATH = `${tmp}/design handoffs/b1.pr-body.md`;

function runShell(cmd) {
  execFileSync('sh', ['-c', cmd], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: tmp }, cwd: tmp, stdio: 'pipe' });
  return readFileSync(argvLog).toString('utf8').split('\0').slice(0, -1);
}

test('the doc has no quoted-placeholder command and no --body @-', () => {
  assert.doesNotMatch(DOC, /--title '\{pr_title\}'/);
  assert.doesNotMatch(DOC, /--body @-/);
  assert.doesNotMatch(DOC, /<<<\s*'\{pr_body\}'/);
  assert.match(DOC, /--body-file/);
});

test('the helper block builds a command that passes the hostile title as one argument', () => {
  const m = /# ship-mode:pr-create\n([\s\S]*?)\nBash\(pr_create_cmd/.exec(DOC);
  assert.ok(m, 'helper block marker "# ship-mode:pr-create" not found in the doc');
  const py = `${m[1]}\nimport os, sys\nsys.stdout.write(pr_create_cmd(os.environ["T"], os.environ["B"]))`;
  const cmd = execFileSync('python3', ['-I', '-c', py], { env: { T: TITLE, B: BODY_PATH }, encoding: 'utf8' });
  const argv = runShell(cmd);
  assert.deepEqual(argv, ['pr', 'create', '--title', TITLE, '--body-file', BODY_PATH, '--label', 'claude-design']);
  assert.ok(!existsSync(path.join(tmp, 'PWN')), 'a $( ) in the title ran');
  assert.ok(!existsSync(path.join(tmp, 'PWN2')), 'a backtick in the title ran');
});

test('control: the old command shape fails on the same title', () => {
  const old = `gh pr create --title '${TITLE}' --body @- <<< 'body' --label claude-design`;
  let argv = null;
  try { argv = runShell(old); } catch { argv = 'shell error'; }
  const wanted = ['pr', 'create', '--title', TITLE, '--body-file', BODY_PATH, '--label', 'claude-design'];
  assert.notDeepEqual(argv, wanted, 'the old shape must not pass this check');
});

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
