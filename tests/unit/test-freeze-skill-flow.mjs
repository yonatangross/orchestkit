#!/usr/bin/env node
// ============================================================================
// ork:freeze end-to-end flow (the skill as Claude Code runs it, no live CC)
// ============================================================================
// WHAT THIS GUARDS
//
//   test-freeze-guard.mjs calls the guard's own CLI directly. That passed while
//   the real skill could never apply a fence: the SKILL.md `!` line passed
//   ${CLAUDE_SESSION_ID}, which is not one of the substitutions this repo's
//   placeholder gate accepts, so the arm step got an empty session id and the
//   hook, which looks the fence up by the session_id on its stdin, never found
//   one. Every edit was allowed.
//
//   This test drives the path Claude Code takes instead of the script's API:
//     1. take the `!` line from src/skills/freeze/SKILL.md and expand ONLY the
//        placeholders the repo treats as documented (${CLAUDE_SKILL_DIR},
//        ${CLAUDE_PROJECT_DIR}) plus $ARGUMENTS; anything else reaches the
//        shell as written, as it would in a session;
//     2. run it with sh, and put its output into a session transcript the way
//        the expanded skill body lands in the conversation;
//     3. take the hook command from the SKILL.md frontmatter and feed it a
//        PreToolUse payload with a session_id and that transcript_path.
//   An edit outside the frozen dir must be denied, and a second session in the
//   same project must neither be fenced nor able to claim the arm.
// ============================================================================

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, realpathSync, rmSync } from 'node:fs';
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

/** Run the skill invocation for `args` and append the expanded body to the transcript. */
function invokeSkill(transcript, args) {
  const cmd = bangLine.slice(2, -1)
    .replaceAll('${CLAUDE_SKILL_DIR}', SKILL_DIR)
    .replaceAll('${CLAUDE_PROJECT_DIR}', project)
    .replaceAll('$ARGUMENTS', args);
  const r = spawnSync('sh', ['-c', cmd], { cwd: project, encoding: 'utf8', env: shellEnv });
  const body = skillText.replace(bangLine, r.stdout.trim());
  appendFileSync(transcript, `${JSON.stringify({ type: 'user', isMeta: true, message: { role: 'user', content: [{ type: 'text', text: body }] } })}\n`);
  return r;
}

/** Run the frontmatter hook command for one edit in one session. */
function edit(sessionId, transcript, filePath) {
  const payload = {
    session_id: sessionId,
    transcript_path: transcript,
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

const txA = path.join(base, 'session-a.jsonl');
const txB = path.join(base, 'session-b.jsonl');
writeFileSync(txA, `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'start' } })}\n`);
writeFileSync(txB, `${JSON.stringify({ type: 'user', message: { role: 'user', content: 'other work' } })}\n`);

const armed = invokeSkill(txA, 'src/feature');
check('arm step exits 0', armed.status, 0);

check('session B is not fenced by A\'s arm', edit('session-b', txB, path.join(sibling, 'b.ts')), 0);
check('session A: outside write denied', edit('session-a', txA, path.join(sibling, 'b.ts')), 2);
check('session A: inside write allowed', edit('session-a', txA, path.join(frozen, 'a.ts')), 0);
check('session A: still denied on a later call', edit('session-a', txA, path.join(sibling, 'c.ts')), 2);
check('session B still not fenced after A bound', edit('session-b', txB, path.join(sibling, 'b.ts')), 0);

const refused = invokeSkill(txA, 'src/missing');
check('arm of a missing dir is refused', refused.status, 1);
check('refused arm keeps the fence', edit('session-a', txA, path.join(sibling, 'b.ts')), 2);

const off = invokeSkill(txA, 'off');
check('off exits 0', off.status, 0);
check('session A: outside write allowed after off', edit('session-a', txA, path.join(sibling, 'b.ts')), 0);

rmSync(base, { recursive: true, force: true });

if (failures.length > 0) {
  console.log(`freeze-skill-flow: ${failures.length} failed, ${passed} passed`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`freeze-skill-flow: ${passed} passed`);
