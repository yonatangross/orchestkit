#!/usr/bin/env node
/**
 * Edit fence for the freeze skill. Two modes in one file so the writer and the
 * reader of the state can never disagree on its location or shape.
 *
 *   arm <project-dir> <session-id> <dir|off>
 *       Run by the skill's own invocation (a `!` line in SKILL.md, after Claude
 *       Code substitutes the project dir, the session id and the argument).
 *       Resolves <dir> against the project dir, follows symlinks, refuses a
 *       path that is not an existing directory, and records the real path in
 *       <project>/.claude/state/freeze/<session-id>.json. `off` deletes it.
 *       A refused arm leaves any previous freeze in place.
 *
 *   (no arguments)
 *       PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit, registered
 *       by the skill's frontmatter. Reads the payload on stdin, looks up this
 *       session's state, and denies (exit 2, reason on stderr) any target whose
 *       real path is outside the frozen dir. The target is resolved the way the
 *       write would land: symlinks followed, a dangling link chased to its
 *       target, a new file judged by the real path of its nearest existing
 *       ancestor. So a link inside the frozen dir that points out is outside.
 *
 * No state for the session means not frozen (allow). A payload that cannot be
 * read, or an edit call with no path, is denied: the fence cannot vouch for it.
 * Node stdlib only.
 *
 * Exit: arm 0 ok · 1 refused. Hook 0 allow · 2 deny.
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_SESSION = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_LINK_HOPS = 40;

export function statePath(projectDir, sessionId) {
  return join(projectDir, '.claude', 'state', 'freeze', `${sessionId}.json`);
}

/** Real path of the nearest existing ancestor, with the missing tail re-joined. */
function realViaAncestor(absolutePath) {
  const missing = [];
  let cursor = absolutePath;
  for (;;) {
    try {
      const real = realpathSync(cursor);
      return missing.length === 0 ? real : join(real, ...missing.reverse());
    } catch {
      const parent = dirname(cursor);
      if (parent === cursor) return null;
      missing.push(basename(cursor));
      cursor = parent;
    }
  }
}

/** Where a write to targetPath would land. null when it cannot be determined. */
export function resolveWriteTarget(targetPath, cwd) {
  if (typeof targetPath !== 'string' || targetPath === '') return null;
  let current = isAbsolute(targetPath) ? targetPath : resolve(cwd, targetPath);
  for (let hop = 0; hop < MAX_LINK_HOPS; hop++) {
    try {
      return realpathSync(current);
    } catch {
      // Missing leaf, or a link whose target is missing: chase the link by hand.
    }
    let st;
    try {
      st = lstatSync(current);
    } catch {
      return realViaAncestor(current);
    }
    if (!st.isSymbolicLink()) return realViaAncestor(current);
    const link = readlinkSync(current);
    const parent = realViaAncestor(dirname(current));
    if (parent === null) return null;
    current = isAbsolute(link) ? link : resolve(parent, link);
  }
  return null;
}

/** Is the real landing spot of targetPath inside frozenDir (already a real path)? */
export function checkFrozenPath(targetPath, frozenDir, cwd) {
  const real = resolveWriteTarget(targetPath, cwd);
  if (real === null) return { inside: false, real: null };
  const rel = relative(frozenDir, real);
  const inside = rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  return { inside, real };
}

function arm(args) {
  const [projectDir, sessionId, ...rest] = args;
  const target = rest.join(' ').trim();
  if (!projectDir || !isAbsolute(projectDir) || !sessionId || !SAFE_SESSION.test(sessionId)) {
    process.stdout.write('freeze NOT changed: the skill was invoked without a usable project dir or session id.\n');
    return 1;
  }
  const file = statePath(projectDir, sessionId);
  if (target === '') {
    const state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    process.stdout.write(state
      ? `freeze is ON for this session: edits are limited to ${state.dir}\n`
      : 'freeze is OFF for this session. Pass a directory to turn it on.\n');
    return 0;
  }
  if (target === 'off') {
    rmSync(file, { force: true });
    process.stdout.write('freeze is OFF for this session: Edit and Write may touch any path again.\n');
    return 0;
  }
  let dir;
  try {
    dir = realpathSync(isAbsolute(target) ? target : resolve(projectDir, target));
    if (!statSync(dir).isDirectory()) throw new Error('not a directory');
  } catch {
    const previous = existsSync(file) ? `; the previous freeze stays: ${JSON.parse(readFileSync(file, 'utf8')).dir}` : '';
    process.stdout.write(`freeze NOT changed: ${target} is not an existing directory${previous}.\n`);
    return 1;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ dir, armedAt: new Date().toISOString() })}\n`);
  process.stdout.write(`freeze is ON for this session: Edit, Write, MultiEdit and NotebookEdit are limited to ${dir}\n`);
  return 0;
}

function deny(reason) {
  process.stderr.write(`${reason}\n`);
  return 2;
}

function hook() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch (err) {
    return deny(`[ork:freeze] could not read the hook input (${err.message}); blocking because the target cannot be checked.`);
  }
  const sessionId = payload?.session_id;
  const projectDir = process.env.CLAUDE_PROJECT_DIR || payload?.cwd;
  if (typeof sessionId !== 'string' || !SAFE_SESSION.test(sessionId) || typeof projectDir !== 'string') {
    return deny('[ork:freeze] the hook input carries no usable session id or project dir; blocking because the freeze state cannot be found.');
  }
  const file = statePath(projectDir, sessionId);
  if (!existsSync(file)) return 0;
  let frozen;
  try {
    frozen = JSON.parse(readFileSync(file, 'utf8')).dir;
  } catch (err) {
    return deny(`[ork:freeze] the freeze state at ${file} is unreadable (${err.message}); blocking until the freeze skill is run again.`);
  }
  const input = payload.tool_input ?? {};
  const target = input.file_path ?? input.notebook_path;
  const cwd = typeof payload.cwd === 'string' ? payload.cwd : projectDir;
  const { inside, real } = checkFrozenPath(target, frozen, cwd);
  if (inside) return 0;
  return deny([
    `[ork:freeze] ${payload.tool_name ?? 'edit'} blocked: ${real ?? target ?? '(no path)'} is outside the frozen dir ${frozen}.`,
    'freeze limits Edit, Write, MultiEdit and NotebookEdit to that directory for this session (symlinks are followed).',
    'To proceed, ask the operator to widen the freeze, or to lift it with the freeze skill and the argument off.',
  ].join('\n'));
}

function main(argv) {
  if (argv[0] === 'arm') return arm(argv.slice(1));
  if (argv.length === 0) return hook();
  process.stderr.write('usage: freeze-guard.mjs arm <project-dir> <session-id> <dir|off>   |   freeze-guard.mjs < hook-payload.json\n');
  return 1;
}

function isEntryPoint() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exitCode = main(process.argv.slice(2));
