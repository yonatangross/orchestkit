#!/usr/bin/env node
/**
 * Edit fence for the freeze skill. Two modes in one file so the writer and the
 * reader of the state can never disagree on its location or shape.
 *
 *   arm <project-dir> <dir|off>
 *       Run by the skill's own invocation (a `!` line in SKILL.md). Claude Code
 *       substitutes ${CLAUDE_SKILL_DIR}, ${CLAUDE_PROJECT_DIR} and $ARGUMENTS
 *       there, but the arm step does not learn which session invoked it, so it
 *       does not bind anything. It resolves <dir> (symlinks followed, must be an
 *       existing directory), writes a PENDING arm keyed by a random nonce to
 *       <project>/.claude/state/freeze/pending/<nonce>.json, and prints the
 *       nonce. That printed line becomes part of the skill body, which lands in
 *       the invoking session's transcript. A refused arm writes nothing.
 *
 *   (no arguments)
 *       PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit, registered
 *       by the skill's frontmatter. The hook owns the session key: it gets
 *       session_id and transcript_path on stdin. Before judging an edit it
 *       claims every fresh pending arm whose nonce appears in ITS OWN transcript
 *       and folds it into <project>/.claude/state/freeze/<session-id>.json.
 *       Then it denies (exit 2, reason on stderr) any target whose real path is
 *       outside the frozen dir: symlinks followed, a dangling link chased to its
 *       target, a new file judged by the real path of its nearest existing
 *       ancestor.
 *
 * Races, and how they close:
 *   - Two sessions in one project: an arm binds only to a session whose
 *     transcript contains its 128-bit nonce, which only the invoking session's
 *     transcript does. Another session never claims it, so it is neither
 *     fenced nor able to steal the fence.
 *   - Parallel edit calls in one session: claiming is idempotent. Each process
 *     writes the session state (atomic rename) BEFORE deleting the pending file,
 *     and an arm older than the state already applied is skipped, so whichever
 *     process runs last, the state reflects the newest arm and no call judges
 *     an edit before the state it claimed exists.
 *   - Arms are applied oldest first; the newest arm (a new dir, or off) wins.
 *     Pending arms older than PENDING_TTL_MS are pruned unclaimed.
 *
 * No bound state for the session means not frozen (allow). A payload that
 * cannot be read, or an edit call with no path, is denied: the fence cannot
 * vouch for it. Node stdlib only.
 *
 * Exit: arm 0 ok · 1 refused. Hook 0 allow · 2 deny.
 */
import { randomBytes } from 'node:crypto';
import {
  existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync,
  realpathSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAFE_SESSION = /^[A-Za-z0-9_-]{1,128}$/;
const NONCE = /^[0-9a-f]{32}$/;
const MAX_LINK_HOPS = 40;
export const PENDING_TTL_MS = 30 * 60 * 1000;

const stateDir = (projectDir) => join(projectDir, '.claude', 'state', 'freeze');
export const pendingDir = (projectDir) => join(stateDir(projectDir), 'pending');

export function statePath(projectDir, sessionId) {
  return join(stateDir(projectDir), `${sessionId}.json`);
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

function writeJsonAtomic(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value)}\n`);
  renameSync(tmp, file);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function arm(args) {
  const [projectDir, ...rest] = args;
  const target = rest.join(' ').trim();
  if (!projectDir || !isAbsolute(projectDir)) {
    process.stdout.write('freeze NOT changed: the skill was invoked without a usable project dir.\n');
    return 1;
  }
  if (target === '') {
    process.stdout.write('freeze NOT changed: pass a directory to fence edits to, or off to lift the fence.\n');
    return 1;
  }
  let dir = null;
  if (target !== 'off') {
    try {
      dir = realpathSync(isAbsolute(target) ? target : resolve(projectDir, target));
      if (!statSync(dir).isDirectory()) throw new Error('not a directory');
    } catch {
      process.stdout.write(`freeze NOT changed: ${target} is not an existing directory; any fence already on stays.\n`);
      return 1;
    }
  }
  const nonce = randomBytes(16).toString('hex');
  writeJsonAtomic(join(pendingDir(projectDir), `${nonce}.json`), { nonce, dir, armedAt: Date.now() });
  process.stdout.write(dir === null
    ? `freeze arm ${nonce}: off. The fence is lifted for this session from its next edit call.\n`
    : `freeze arm ${nonce}: Edit, Write, MultiEdit and NotebookEdit are limited to ${dir} for this session from its next edit call.\n`);
  return 0;
}

/**
 * Fold every fresh pending arm whose nonce is in this session's transcript into
 * the session state. Returns the session state after claiming (or null).
 */
export function claimPending(projectDir, sessionId, transcriptPath, now = Date.now()) {
  const file = statePath(projectDir, sessionId);
  let state = readJson(file);
  let names;
  try {
    names = readdirSync(pendingDir(projectDir)).filter((n) => n.endsWith('.json'));
  } catch {
    return state;
  }
  const arms = [];
  for (const n of names) {
    const p = join(pendingDir(projectDir), n);
    const a = readJson(p);
    if (!a || !NONCE.test(a.nonce ?? '') || typeof a.armedAt !== 'number') continue;
    if (now - a.armedAt > PENDING_TTL_MS) {
      rmSync(p, { force: true });
      continue;
    }
    arms.push({ ...a, path: p });
  }
  if (arms.length === 0 || typeof transcriptPath !== 'string') return state;
  let transcript;
  try {
    transcript = readFileSync(transcriptPath, 'utf8');
  } catch {
    return state;
  }
  arms.sort((x, y) => x.armedAt - y.armedAt);
  for (const a of arms) {
    if (!transcript.includes(a.nonce)) continue;
    if (!state || a.armedAt >= state.armedAt) {
      state = { dir: a.dir, armedAt: a.armedAt, nonce: a.nonce };
      writeJsonAtomic(file, state);
    }
    rmSync(a.path, { force: true });
  }
  return state;
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
  if (!existsSync(stateDir(projectDir))) return 0;
  const state = claimPending(projectDir, sessionId, payload.transcript_path);
  const frozen = state?.dir;
  if (typeof frozen !== 'string') return 0;
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
  process.stderr.write('usage: freeze-guard.mjs arm <project-dir> <dir|off>   |   freeze-guard.mjs < hook-payload.json\n');
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
