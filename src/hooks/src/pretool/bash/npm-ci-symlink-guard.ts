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
import { outputSilentSuccess, outputDeny, outputAsk } from '../../lib/common.js';
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
const WRAPPERS = new Set(['env', 'time', 'command', 'exec', 'nohup', 'nice', 'sudo', 'doas', 'timeout']);

/** Per wrapper, the options that take the next word as their value (#5169). */
const WRAPPER_VALUE_OPTIONS: Record<string, Set<string>> = {
  nice: new Set(['-n', '--adjustment']),
  sudo: new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U']),
  doas: new Set(['-u', '-C']),
  env: new Set(['-u', '--unset', '-S', '--split-string']),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
};

/** Shell words that open or continue a compound command; the command after them is what runs (#5169). */
const SHELL_KEYWORDS = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '{', '}', 'esac', 'fi', 'done']);

/** Shells whose `-c <script>` argument is read as one more command (#5169). */
const SHELLS = 'bash|sh|zsh|dash|ksh';

/** One word as the shell would read it: backslash escapes and quotes removed. */
function shellWord(word: string): string {
  return word.replace(/\\(.)/g, '$1').replace(/["']/g, '');
}

/**
 * Strip shell grammar from the front of a segment until a command word is
 * left: `case <word> in`, a case pattern `<pat>)` or `(<pat>)`, and the
 * keywords above. `if true; then npm ci; fi` reaches `npm ci` this way.
 */
function stripShellGrammar(segment: string): string {
  let s = segment.trim();
  for (let prev = ''; prev !== s; ) {
    prev = s;
    s = s.replace(/^case\s+\S+\s+in(\s+|$)/, '');
    s = s.replace(/^\(?[^\s()]+\)(\s+|$)/, '');
    const first = /^(\S+)(\s+|$)/.exec(s);
    if (first && SHELL_KEYWORDS.has(first[1])) s = s.slice(first[0].length);
    s = s.trim();
  }
  return s.replace(/\s*\}$/, '').trim();
}

/** `~` and `~/x` against the home dir; anything else unchanged. */
function expandHome(dir: string, home: string): string {
  if (home && (dir === '~' || dir.startsWith('~/'))) return home + dir.slice(1);
  return dir;
}

/**
 * Replace each command substitution ($(...), $((...)), `...`) with a plain
 * word, innermost first. Its parentheses are not subshell parentheses, and
 * its separators do not split the outer command.
 */
function blankSubstitutions(command: string): string {
  let out = command.replace(/`[^`]*`/g, '_');
  for (let prev = ''; prev !== out; ) {
    prev = out;
    out = out.replace(/\$\(\([^()]*\)\)/g, '_').replace(/\$\([^()]*\)/g, '_');
  }
  return out;
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
  return scan(blankSubstitutions(command), cwd, home).target;
}

/** The script of every `bash -c '<script>'` (and sh, zsh, dash, ksh) in the command (#5169). */
function nestedShellBodies(command: string): string[] {
  const bodies: string[] = [];
  const re = new RegExp(`(?:^|[^\\w/-])(?:${SHELLS})((?:\\s+-[a-zA-Z]+)*?)\\s+-[a-zA-Z]*c\\s+(?:"([^"]*)"|'([^']*)'|(\\S+))`, 'g');
  for (const m of command.matchAll(re)) bodies.push(m[2] ?? m[3] ?? m[4] ?? '');
  return bodies;
}

/** Bodies of every $(...) and `...` in the command, innermost first. */
function substitutionBodies(command: string): string[] {
  const bodies: string[] = [];
  for (const m of command.matchAll(/`([^`]*)`/g)) bodies.push(m[1]);
  let text = command;
  for (let prev = ''; prev !== text; ) {
    prev = text;
    text = text.replace(/\$\(([^()]*)\)/g, (_all, body: string) => {
      bodies.push(body);
      return '_';
    });
  }
  return bodies;
}

/**
 * Every directory a clean install in `command` might clear, or [] when no
 * reading of the command finds a clean install. The parser cannot follow
 * every shell form (quotes around a backtick, an escaped ')', a case
 * pattern), so it reads the command several ways (substitutions blanked,
 * the raw text, each substitution body on its own) and, if any reading
 * finds a clean install, returns the cwd, every cd and prefix directory any
 * reading passed through, and every target. A misparse then checks too many
 * directories, never too few.
 */
export function npmCiCandidateDirs(command: string, cwd: string, home: string = process.env.HOME ?? ''): string[] {
  const scans = readingsOf(command).map((text) => scan(text, cwd, home));
  if (!scans.some((s) => s.target !== null)) return [];
  const dirs = new Set<string>([cwd]);
  for (const s of scans) {
    for (const d of s.seen) dirs.add(d);
    if (s.target !== null) dirs.add(s.target);
  }
  return [...dirs];
}

/** Every reading of a command: substitutions blanked, raw, each substitution body, each nested shell script. */
function readingsOf(command: string): string[] {
  return [blankSubstitutions(command), command, ...substitutionBodies(command), ...nestedShellBodies(command)];
}

/**
 * The fail-safe half (#5169). When no reading finds a clean install but the
 * text still holds `npm` and, later, a clean-install word (after quotes and
 * escapes are removed), return the cwd and every directory any reading passed
 * through, so the guard can ask instead of failing open. [] otherwise.
 */
export function npmCiMentionDirs(command: string, cwd: string, home: string = process.env.HOME ?? ''): string[] {
  const words = shellWord(command).split(/[\s;&|()]+/).filter(Boolean);
  const npmAt = words.indexOf('npm');
  if (npmAt === -1 || !words.slice(npmAt + 1).some((w) => CLEAN_INSTALL.has(w))) return [];
  const dirs = new Set<string>([cwd]);
  for (const text of readingsOf(command)) for (const d of scan(text, cwd, home).seen) dirs.add(d);
  return [...dirs];
}

/** One reading of a command: the clean-install target (or null) and every directory it passed through. */
function scan(command: string, cwd: string, home: string): { target: string | null; seen: string[] } {
  const seen: string[] = [cwd];
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
    // A brace group runs in the current shell, so `{ cd X; }` moves the
    // directory for what follows; only the grammar is stripped (#5169).
    segment = stripShellGrammar(segment);
    const cd = /^cd\s+("[^"]*"|'[^']*'|\S+)$/.exec(segment);
    if (cd) {
      dir = resolveDir(dir, unquote(cd[1]), home);
      seen.push(dir);
      restore();
      continue;
    }
    const words = segment.split(/\s+/).filter(Boolean).map(shellWord);
    // `env -C DIR` runs this one command in DIR, without moving the shell.
    let cmdDir = dir;
    let start = 0;
    while (start < words.length) {
      const w = words[start];
      if (/^\w+=/.test(w)) {
        start++;
        continue;
      }
      if (!WRAPPERS.has(w)) break;
      start++;
      const valueOptions = WRAPPER_VALUE_OPTIONS[w] ?? new Set<string>();
      while (start < words.length && words[start].startsWith('-')) {
        const option = words[start++];
        if (w === 'env' && (option === '-C' || option === '--chdir') && start < words.length) {
          cmdDir = resolveDir(cmdDir, words[start++], home);
          seen.push(cmdDir);
        } else if (valueOptions.has(option) && start < words.length) {
          start++;
        }
      }
      // timeout takes a duration before the command.
      if (w === 'timeout' && start < words.length && /^\d/.test(words[start])) start++;
    }
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
    if (prefix !== null) seen.push(resolveDir(cmdDir, prefix, home));
    if (sub !== null && CLEAN_INSTALL.has(sub)) {
      return { target: prefix === null ? cmdDir : resolveDir(cmdDir, prefix, home), seen };
    }
    restore();
  }
  return { target: null, seen };
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

  const cwd = input.cwd || ctx.projectDir;
  const candidates = npmCiCandidateDirs(command, cwd);
  if (candidates.length === 0) {
    // No reading found a clean install, yet the text names one: a shape the
    // parser cannot place. Ask instead of failing open, but only where a
    // linked node_modules is at stake (#5169).
    const mentioned = npmCiMentionDirs(command, cwd)
      .map((d) => join(d, 'node_modules'))
      .find((m) => deps.isSymlink(m));
    if (mentioned === undefined) return outputSilentSuccess();
    ctx.log(HOOK_NAME, `asked about an unparsed npm clean install near symlinked ${mentioned}`);
    return outputAsk(
      `This command mentions npm ci (or another clean install) in a form the npm ci guard cannot read, and ${mentioned} is a symlink. ` +
        'If it runs npm ci there, it empties the linked tree (the main repository in a reclaimed worktree). Use npm install instead, or confirm it does not run npm ci.',
    );
  }
  const linked = candidates.map((d) => join(d, 'node_modules')).find((m) => deps.isSymlink(m));
  if (linked === undefined) return outputSilentSuccess();
  const modules = linked;

  ctx.log(HOOK_NAME, `denied clean install through symlinked ${modules}`);
  return outputDeny(
    `npm ci would empty the shared tree: ${modules} is a symlink, and npm ci deletes node_modules by following it, ` +
      'which empties the linked tree (the main repository in a reclaimed worktree) and breaks every worktree that shares it. ' +
      'Use npm install here instead: it replaces the link with a real directory and leaves the shared tree alone.',
  );
}
