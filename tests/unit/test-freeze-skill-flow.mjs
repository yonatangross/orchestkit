#!/usr/bin/env node
// ============================================================================
// ork:freeze end-to-end flow (the skill as Claude Code runs it, no live CC)
// ============================================================================
// WHAT THIS GUARDS
//
//   test-freeze-guard.mjs calls the guard's CLI with a session id it chose
//   itself, so it cannot see whether the SKILL itself delivers one. This test
//   drives the path Claude Code takes:
//     1. take the `!` line from src/skills/freeze/SKILL.md and expand the
//        substitutions code.claude.com/docs/en/skills documents for skill
//        content (${CLAUDE_SKILL_DIR}, ${CLAUDE_PROJECT_DIR},
//        ${CLAUDE_SESSION_ID}, $ARGUMENTS); anything else reaches the shell as
//        written, as it would in a session;
//     2. run it with sh in an environment with no CLAUDE_* variables;
//     3. take the hook command from the SKILL.md frontmatter and feed it a
//        PreToolUse payload carrying the SAME session_id, as Claude Code does.
//   An edit outside the frozen dir must be denied in that session, and a fence
//   armed under session X must not apply to session Y.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL_DIR = path.join(ROOT, 'src', 'skills', 'freeze');
const PLUGIN_ROOT = path.join(ROOT, 'src');
const skillText = readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

let passed = 0;
const failures = [];
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed++;
  else failures.push(`${name}\n      expected ${e}\n      actual   ${a}`);
}

const bangLine = skillText.split('\n').find((l) => l.startsWith('!`') && l.endsWith('`'));
const hookCommand = skillText.match(/^\s*command:\s*'(.*)'\s*$/m)?.[1];
check('SKILL.md has a ! arm line', typeof bangLine, 'string');
check('SKILL.md has a hook command', typeof hookCommand, 'string');

const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'ork-freeze-flow-')));
const project = path.join(base, 'project');
const frozen = path.join(project, 'src', 'feature');
const sibling = path.join(project, 'src', 'other');
mkdirSync(frozen, { recursive: true });
mkdirSync(sibling, { recursive: true });

// A session environment without any CLAUDE_* variable the shell could fill in.
const shellEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_')));

/** Run the skill's `!` line as Claude Code does when `sessionId` invokes it with `args`. */
function invokeSkill(sessionId, args) {
  const cmd = bangLine.slice(2, -1)
    .replaceAll('${CLAUDE_SKILL_DIR}', SKILL_DIR)
    .replaceAll('${CLAUDE_PROJECT_DIR}', project)
    .replaceAll('${CLAUDE_SESSION_ID}', sessionId)
    .replaceAll('$ARGUMENTS', () => args); // a function, so a `$` in args is not a replace pattern
  // A shell string on purpose: Claude Code runs the `!` line through a shell, and
  // how that shell treats the quoting (spaces, `$`) is what this test checks. The
  // inputs are this repo's SKILL.md and paths under a mkdtemp dir, not user data.
  return spawnSync('sh', ['-c', cmd], { cwd: project, encoding: 'utf8', env: shellEnv });
}

/** Run the frontmatter hook command for one edit in one session. */
function edit(sessionId, filePath) {
  const payload = {
    session_id: sessionId,
    transcript_path: path.join(base, `${sessionId}.jsonl`),
    cwd: project,
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: filePath, content: 'x' },
  };
  return spawnSync('sh', ['-c', hookCommand], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...shellEnv, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT, CLAUDE_PROJECT_DIR: project },
  }).status;
}

const X = 'b1f0c3a2-7d4e-4c55-9a0e-2f6d8c1e9b7a';
const Y = '5e2a9d10-3c7b-4f81-8b6e-0d4f2a7c9e13';

const armed = invokeSkill(X, 'src/feature');
check('arm step exits 0', armed.status, 0);
check('arm step reports the fence', armed.stdout.includes(frozen), true);

check('session X: outside write denied', edit(X, path.join(sibling, 'b.ts')), 2);
check('session X: inside write allowed', edit(X, path.join(frozen, 'a.ts')), 0);
check('session X: new file inside allowed', edit(X, path.join(frozen, 'new', 'c.ts')), 0);
check('session Y: fence armed under X does not apply', edit(Y, path.join(sibling, 'b.ts')), 0);

const refused = invokeSkill(X, 'src/missing');
check('arm of a missing dir is refused', refused.status, 1);
check('refused arm keeps the fence', edit(X, path.join(sibling, 'b.ts')), 2);

// A dir name with a space and a literal `$` must reach the guard as typed:
// the shell may neither split it nor expand `$HOME` (review round 3).
const oddRel = 'src/odd dir $HOME x';
const odd = path.join(project, oddRel);
mkdirSync(odd, { recursive: true });
const oddArm = invokeSkill(X, oddRel);
check('arm of a dir with a space and $ exits 0', oddArm.status, 0);
check('arm reports the literal dir', oddArm.stdout.includes(odd), true);
check('session X: write inside the odd dir allowed', edit(X, path.join(odd, 'a.ts')), 0);
check('session X: write in the old fence now denied', edit(X, path.join(frozen, 'a.ts')), 2);

const off = invokeSkill(X, 'off');
check('off exits 0', off.status, 0);
check('session X: outside write allowed after off', edit(X, path.join(sibling, 'b.ts')), 0);

rmSync(base, { recursive: true, force: true });

if (failures.length > 0) {
  console.log(`freeze-skill-flow: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`freeze-skill-flow: ${passed} passed`);
