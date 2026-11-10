/**
 * npm ci Symlink Guard - PreToolUse Bash, inside sync-bash-dispatcher.
 *
 * `npm ci` starts by deleting node_modules, and it FOLLOWS a symlink while
 * doing so. In a worktree whose node_modules links to a shared tree (what
 * bin/worktree-reclaim.sh sets up), that empties the MAIN repository's
 * node_modules and breaks every other worktree, while npm still prints a
 * normal "added N packages" line.
 *
 * dangerous-command-blocker denied this until #3841 deleted that hook. A
 * permissions.deny rule cannot replace it: a rule sees only the command text,
 * not whether node_modules is a link, so it would have to block every npm ci.
 * This guard denies only the destructive case and points at the safe
 * command (`npm install`, which replaces the link with a real directory).
 *
 * The filesystem probe comes in through `deps` (FH-ready policy); the target
 * directory is resolved from the command text: `--prefix <dir>`, a preceding
 * `cd <dir>` in the same command line, else the input cwd, else the project.
 */

import { isAbsolute, join, resolve } from 'node:path';
import type { HookInput, HookResult, HookContext } from '../../types.js';
import { outputSilentSuccess, outputDeny } from '../../lib/common.js';
import { NOOP_CTX } from '../../lib/context.js';
import { isSymlinkPath } from '../../lib/fs-probe.js';

const HOOK_NAME = 'npm-ci-symlink-guard';

/** npm subcommands that run a clean install (npm's own aliases for ci and cit). */
const CLEAN_INSTALL = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'clean-install-test', 'sit']);

export interface NpmCiSymlinkGuardDeps {
  /** True when the path is a symbolic link. */
  isSymlink: (path: string) => boolean;
}

const DEFAULT_DEPS: NpmCiSymlinkGuardDeps = { isSymlink: isSymlinkPath };

/** npm options that take their value as the next word (`--prefix` and `-C` are handled apart). */
const VALUE_FLAGS = new Set([
  '--loglevel', '--workspace', '-w', '--userconfig', '--globalconfig', '--cache', '--registry',
  '--tag', '--otp', '--include', '--omit', '--before', '--install-strategy', '--scope',
]);

/** npm's spellings of the install prefix. */
const PREFIX_FLAGS = new Set(['--prefix', '-C']);

/** Command words that run the rest of the segment as a command. */
const WRAPPERS = new Set(['env', 'time', 'command', 'exec', 'nohup', 'nice']);

/** `~` and `~/x` against the home dir; anything else unchanged. */
function expandHome(dir: string, home: string): string {
  if (home && (dir === '~' || dir.startsWith('~/'))) return home + dir.slice(1);
  return dir;
}

function resolveDir(base: string, dir: string, home: string): string {
  const expanded = expandHome(dir, home);
  return isAbsolute(expanded) ? expanded : resolve(base, expanded);
}

/** Strip one pair of matching outer quotes from a token. */
function unquote(token: string): string {
  const m = /^(['"])(.*)\1$/.exec(token);
  return m ? m[2] : token;
}

/**
 * The directory whose node_modules a clean install in `command` would clear,
 * or null when the command runs no clean install. Commands are split on
 * shell separators (including a backgrounding `&`); a subshell's
 * directory ends with its closing parenthesis; `cd <dir>` (quoted or not, `~` expanded) updates the directory for
 * what follows; a segment counts only when `npm` is its command word after env
 * assignments and wrappers such as `env`, `time` and `command`. Options that
 * take a value (`--loglevel warn`, `-w api`) are skipped with their value, so
 * the value is never read as the subcommand.
 */
export function npmCiTargetDir(command: string, cwd: string, home: string = process.env.HOME ?? ''): string | null {
  let dir = cwd;
  // A subshell runs in a copy of the shell: a cd inside it ends when it
  // closes. Each '(' saves the directory, each ')' restores it.
  const saved: string[] = [];
  for (const raw of command.split(/&&|\|\||[;|&\n]/)) {
    let segment = raw.trim();
    const opens = /^\(+/.exec(segment)?.[0].length ?? 0;
    segment = segment.slice(opens).trim();
    const closes = /\)+$/.exec(segment)?.[0].length ?? 0;
    segment = segment.slice(0, segment.length - closes).trim();
    for (let n = 0; n < opens; n++) saved.push(dir);
    const restore = () => {
      for (let n = 0; n < closes; n++) dir = saved.pop() ?? dir;
    };
    const cd = /^cd\s+("[^"]*"|'[^']*'|\S+)$/.exec(segment);
    if (cd) {
      dir = resolveDir(dir, unquote(cd[1]), home);
      restore();
      continue;
    }
    const words = segment.split(/\s+/).filter(Boolean);
    let start = 0;
    while (start < words.length && (/^\w+=/.test(words[start]) || WRAPPERS.has(words[start]))) start++;
    const tokens = words.slice(start);
    if (tokens[0] !== 'npm') {
      restore();
      continue;
    }
    let prefix: string | null = null;
    let sub: string | null = null;
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('--prefix=')) prefix = unquote(t.slice('--prefix='.length));
      else if (PREFIX_FLAGS.has(t) && i + 1 < tokens.length) prefix = unquote(tokens[++i]);
      else if (VALUE_FLAGS.has(t)) i++;
      else if (!t.startsWith('-') && sub === null) sub = t;
    }
    if (sub !== null && CLEAN_INSTALL.has(sub)) {
      return prefix === null ? dir : resolveDir(dir, prefix, home);
    }
    restore();
  }
  return null;
}

/**
 * Deny a clean install whose node_modules is a symlink; silent otherwise.
 */
export function npmCiSymlinkGuard(
  input: HookInput,
  ctx: HookContext = NOOP_CTX,
  deps: NpmCiSymlinkGuardDeps = DEFAULT_DEPS,
): HookResult {
  const command = input.tool_input?.command;
  if (typeof command !== 'string' || !command.includes('npm')) return outputSilentSuccess();

  const target = npmCiTargetDir(command, input.cwd || ctx.projectDir);
  if (target === null) return outputSilentSuccess();

  const modules = join(target, 'node_modules');
  if (!deps.isSymlink(modules)) return outputSilentSuccess();

  ctx.log(HOOK_NAME, `denied clean install through symlinked ${modules}`);
  return outputDeny(
    `npm ci would empty the shared tree: ${modules} is a symlink, and npm ci deletes node_modules by following it, ` +
      'which empties the linked tree (the main repository in a reclaimed worktree) and breaks every worktree that shares it. ' +
      'Use npm install here instead: it replaces the link with a real directory and leaves the shared tree alone.',
  );
}
