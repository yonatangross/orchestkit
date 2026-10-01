#!/usr/bin/env node
// ============================================================================
// ork:freeze guard unit tests (offline, real temp dirs and symlinks)
// ============================================================================
// WHAT THIS GUARDS
//
//   src/skills/freeze/scripts/freeze-guard.mjs is both halves of the freeze
//   skill: `arm` records the frozen dir for one session (run by the skill's
//   own invocation), and the no-argument form is the PreToolUse
//   Edit|Write|MultiEdit|NotebookEdit hook. The hook must deny, with exit 2
//   and a stderr reason, any edit whose REAL path lands outside the frozen
//   dir, including a path that only looks inside because a symlink inside the
//   dir points out. A lexical startsWith check passes that escape, and a
//   prefix check lets /frozen-evil through for /frozen.
//
// HOW
//
//   A temp tree with a frozen dir, a sibling, and two symlinks. The exported
//   checker is called directly; the CLI is spawned for arm, off and the hook.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, realpathSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFrozenPath, statePath } from '../../src/skills/freeze/scripts/freeze-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI = path.join(ROOT, 'src', 'skills', 'freeze', 'scripts', 'freeze-guard.mjs');

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
  }
}

// --- fixture tree ------------------------------------------------------------
const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'ork-freeze-test-')));
const project = path.join(base, 'project');
const frozen = path.join(project, 'src', 'feature');
const sibling = path.join(project, 'src', 'other');
const evil = path.join(project, 'src', 'feature-evil');
mkdirSync(frozen, { recursive: true });
mkdirSync(sibling, { recursive: true });
mkdirSync(evil, { recursive: true });
writeFileSync(path.join(frozen, 'a.ts'), 'x');
writeFileSync(path.join(sibling, 'b.ts'), 'x');
symlinkSync(sibling, path.join(frozen, 'escape-dir'));
symlinkSync(path.join(sibling, 'b.ts'), path.join(frozen, 'escape-file.ts'));
symlinkSync(path.join(sibling, 'not-yet.ts'), path.join(frozen, 'dangling.ts'));

const inside = (target, cwd = project) => checkFrozenPath(target, frozen, cwd).inside;

// --- checker -------------------------------------------------------------------
check('existing file inside', inside(path.join(frozen, 'a.ts')), true);
check('new file inside', inside(path.join(frozen, 'new', 'deep', 'c.ts')), true);
check('relative path inside', inside('src/feature/a.ts'), true);
check('file outside', inside(path.join(sibling, 'b.ts')), false);
check('relative path outside', inside('src/other/b.ts'), false);
check('dotdot escape', inside(path.join(frozen, '..', 'other', 'b.ts')), false);
check('prefix sibling is outside', inside(path.join(evil, 'x.ts')), false);
check('symlinked dir escape', inside(path.join(frozen, 'escape-dir', 'b.ts')), false);
check('symlinked dir escape, new file', inside(path.join(frozen, 'escape-dir', 'new.ts')), false);
check('symlinked file escape', inside(path.join(frozen, 'escape-file.ts')), false);
check('dangling symlink escape', inside(path.join(frozen, 'dangling.ts')), false);
check('empty path is not inside', inside(''), false);

// --- CLI: arm, hook, off ---------------------------------------------------------
const SESSION = 'test-session-1';
const env = { ...process.env, CLAUDE_PROJECT_DIR: project };
const cli = (args, input) =>
  spawnSync(process.execPath, [CLI, ...args], { input: input ?? '', encoding: 'utf8', env });
const hook = (tool_name, tool_input, session_id = SESSION) =>
  cli([], JSON.stringify({ session_id, cwd: project, hook_event_name: 'PreToolUse', tool_name, tool_input }));

{
  const r = cli(['arm', project, SESSION, 'src/feature']);
  check('arm exit code', r.status, 0);
  check('arm writes state', existsSync(statePath(project, SESSION)), true);
  check('arm reports the real dir', r.stdout.includes(frozen), true);
}
{
  const r = cli(['arm', project, SESSION, 'src/missing']);
  check('arm refuses a missing dir', r.status, 1);
  check('failed arm keeps the previous freeze', existsSync(statePath(project, SESSION)), true);
}
{
  const r = hook('Edit', { file_path: path.join(frozen, 'a.ts'), old_string: 'x', new_string: 'y' });
  check('hook allows Edit inside', r.status, 0);
}
{
  const r = hook('Write', { file_path: path.join(sibling, 'b.ts'), content: 'y' });
  check('hook denies Write outside', r.status, 2);
  check('deny names the frozen dir', r.stderr.includes(frozen), true);
  check('deny says ask the operator', /operator/i.test(r.stderr), true);
}
{
  const r = hook('MultiEdit', { file_path: path.join(frozen, 'escape-file.ts'), edits: [] });
  check('hook denies MultiEdit symlink escape', r.status, 2);
}
{
  const r = hook('NotebookEdit', { notebook_path: path.join(sibling, 'n.ipynb'), new_source: '' });
  check('hook denies NotebookEdit outside', r.status, 2);
}
{
  const r = hook('NotebookEdit', { notebook_path: path.join(frozen, 'n.ipynb'), new_source: '' });
  check('hook allows NotebookEdit inside', r.status, 0);
}
{
  const r = hook('Write', { content: 'y' });
  check('hook denies a call with no path', r.status, 2);
}
{
  const r = hook('Write', { file_path: path.join(sibling, 'b.ts'), content: 'y' }, 'other-session');
  check('another session is not frozen', r.status, 0);
}
{
  const r = cli([], 'not json');
  check('unreadable hook input fails closed', r.status, 2);
}
{
  const r = cli(['arm', project, SESSION, 'off']);
  check('off exit code', r.status, 0);
  check('off removes state', existsSync(statePath(project, SESSION)), false);
  const after = hook('Write', { file_path: path.join(sibling, 'b.ts'), content: 'y' });
  check('hook allows outside after off', after.status, 0);
}
{
  const r = cli(['arm', project, '../escape', 'src/feature']);
  check('arm refuses an unsafe session id', r.status, 1);
}

rmSync(base, { recursive: true, force: true });

// --- report -------------------------------------------------------------------
if (failures.length > 0) {
  console.log(`freeze-guard: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`freeze-guard: ${passed} passed`);
