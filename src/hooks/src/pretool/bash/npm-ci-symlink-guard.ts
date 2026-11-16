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
import { isSymlinkPath, listSubdirs } from '../../lib/fs-probe.js';

const HOOK_NAME = 'npm-ci-symlink-guard';

/** npm subcommands that run a clean install (npm's own aliases for ci and cit). */
const CLEAN_INSTALL = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'clean-install-test', 'sit']);

export interface NpmCiSymlinkGuardDeps {
  /** True when the path is a symbolic link. */
  isSymlink: (path: string) => boolean;
  /** The real subdirectory names of a path; used only to search for a link when the parse is uncertain. */
  listSubdirs?: (path: string) => string[];
}

const DEFAULT_DEPS: NpmCiSymlinkGuardDeps = { isSymlink: isSymlinkPath, listSubdirs };

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

/**
 * Loose text for detection only: every backslash escape and quote character
 * removed, so `n\pm` and `np''m` read as npm. It over-reads on purpose (an
 * apostrophe inside double quotes is lost), so it must never produce a path.
 */
function shellWord(word: string): string {
  return word.replace(/\\(.)/g, '$1').replace(/["']/g, '');
}

/** Characters a backslash escapes inside double quotes. */
const DQ_ESCAPABLE = '$`"\\\n';

/**
 * Split a segment into words as the shell reads them (Vercel finding
 * 01M73R2WWKHP1QKXGW63DA83C9 on #5195): split only on unquoted blanks; inside
 * single quotes every character is literal; inside double quotes a backslash
 * escapes only $ ` " \ and newline; outside quotes a backslash escapes the next
 * character. Quote characters of the other kind stay in the word, so
 * "a'b" is a'b and '/L\z' is /L\z.
 */
function shellWords(segment: string): string[] {
  const words: string[] = [];
  let cur = '';
  let inWord = false;
  let i = 0;
  while (i < segment.length) {
    const c = segment[i];
    if (/\s/.test(c)) {
      if (inWord) words.push(cur);
      cur = '';
      inWord = false;
      i++;
      continue;
    }
    inWord = true;
    if (c === "'") {
      const end = segment.indexOf("'", i + 1);
      cur += end === -1 ? segment.slice(i + 1) : segment.slice(i + 1, end);
      i = end === -1 ? segment.length : end + 1;
    } else if (c === '"') {
      i++;
      while (i < segment.length && segment[i] !== '"') {
        if (segment[i] === '\\' && i + 1 < segment.length && DQ_ESCAPABLE.includes(segment[i + 1])) {
          cur += segment[i + 1];
          i += 2;
        } else {
          cur += segment[i++];
        }
      }
      i++;
    } else if (c === '\\' && i + 1 < segment.length) {
      cur += segment[i + 1];
      i += 2;
    } else {
      cur += c;
      i++;
    }
  }
  if (inWord) words.push(cur);
  return words;
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
  // A closing brace is grammar only as a word of its own at command position, and the loop above
  // already drops that (`}` is in SHELL_KEYWORDS). It is never stripped from the END of the text:
  // there it is part of an argument, and a directory may be named `wt}` (Vercel Security Review,
  // row 16 finding 3: stripping it probed the wrong sibling and allowed the install).
  return s;
}

/** `~` and `~/x` against the home dir; anything else unchanged. */
function expandHome(dir: string, home: string): string {
  if (home && (dir === '~' || dir.startsWith('~/'))) return home + dir.slice(1);
  return dir;
}

/** One command substitution in a text: [start, end) covers the whole `$(...)` or backtick form. */
interface SubstitutionSpan {
  start: number;
  end: number;
  inner: string;
}

/**
 * The index just past the ')' that closes the `$(` whose '(' is at `open`, or -1
 * when it never closes. Quote- and escape-aware (Vercel Security Review, row 16
 * finding 4): a ')' inside single or double quotes, after a backslash, inside a
 * backtick pair or inside a nested substitution is not the terminator.
 */
function closeOfParen(text: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      i += 2;
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end === -1) return -1;
      i = end + 1;
    } else if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') {
          i += 2;
        } else if (text[i] === '$' && text[i + 1] === '(') {
          const end = closeOfParen(text, i + 1);
          if (end === -1) return -1;
          i = end;
        } else if (text[i] === '`') {
          const end = closeOfBacktick(text, i);
          if (end === -1) return -1;
          i = end;
        } else {
          i++;
        }
      }
      if (i >= text.length) return -1;
      i++;
    } else if (c === '`') {
      const end = closeOfBacktick(text, i);
      if (end === -1) return -1;
      i = end;
    } else if (c === '(') {
      depth++;
      i++;
    } else if (c === ')') {
      depth--;
      i++;
      if (depth === 0) return i;
    } else {
      i++;
    }
  }
  return -1;
}

/** The index just past the backtick that closes the one at `open`, or -1. */
function closeOfBacktick(text: string, open: number): number {
  let i = open + 1;
  while (i < text.length) {
    if (text[i] === '\\') i += 2;
    else if (text[i] === '`') return i + 1;
    else i++;
  }
  return -1;
}

/**
 * The outermost command substitutions of a text, read the way the shell reads
 * quotes: `$(` and a backtick are inert inside single quotes, after a backslash
 * and in a comment, and live inside double quotes. An opener that never closes
 * (a quote, `$(` or a backtick) is stepped over, not taken as the end of the
 * text: stopping there would leave every later substitution unread, and an
 * unread clean install is an allowed one.
 *
 * `skipComments` is one of two readings, never the only one: a `#` the shell does not
 * take as a comment (right after a substitution, in a heredoc body, after `$'\''`)
 * would hide what follows it. readingsOf() reads both ways, so a misread comment can
 * only add candidates, never remove them.
 */
function substitutionSpans(text: string, skipComments = false): SubstitutionSpan[] {
  const spans: SubstitutionSpan[] = [];
  let inDouble = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') {
      i += 2;
    } else if (skipComments && c === '#' && !inDouble && (i === 0 || /[\s;&|()]/.test(text[i - 1] ?? ''))) {
      // A comment runs to the end of its line; nothing in it is a substitution.
      const end = text.indexOf('\n', i + 1);
      i = end === -1 ? text.length : end + 1;
    } else if (c === "'" && !inDouble) {
      const end = text.indexOf("'", i + 1);
      i = end === -1 ? i + 1 : end + 1;
    } else if (c === '"') {
      inDouble = !inDouble;
      i++;
    } else if (c === '$' && text[i + 1] === '(') {
      const end = closeOfParen(text, i + 1);
      if (end === -1) {
        i += 2;
        continue;
      }
      spans.push({ start: i, end, inner: text.slice(i + 2, end - 1) });
      i = end;
    } else if (c === '`') {
      const end = closeOfBacktick(text, i);
      if (end === -1) {
        i++;
        continue;
      }
      spans.push({ start: i, end, inner: text.slice(i + 1, end - 1) });
      i = end;
    } else {
      i++;
    }
  }
  return spans;
}

/**
 * Replace each command substitution ($(...), $((...)), `...`) with a plain
 * word, nested ones included. Its parentheses are not subshell parentheses, and
 * its separators do not split the outer command. Quote-aware: a quoted ')' does
 * not end a substitution early and leave a real terminator behind.
 */
function blankSubstitutions(command: string, skipComments = false): string {
  let out = '';
  let last = 0;
  for (const span of substitutionSpans(command, skipComments)) {
    out += `${command.slice(last, span.start)}_`;
    last = span.end;
  }
  return out + command.slice(last);
}

function resolveDir(base: string, dir: string, home: string): string {
  const expanded = expandHome(dir, home);
  return isAbsolute(expanded) ? expanded : resolve(base, expanded);
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

/** Bodies of every $(...) and `...` in the command, nested ones included, each with its own substitutions blanked. */
function substitutionBodies(command: string): string[] {
  const bodies = new Set<string>();
  // No depth cap (a cap that stops quietly fails open): every body is strictly shorter than the
  // text it came from, so the walk ends; the set keeps repeated bodies from being walked twice.
  // Dedup on the RAW inner text: blanked bodies of different nesting levels can be equal ("_"),
  // and skipping on those would stop the walk before the innermost body.
  const walked = new Set<string>();
  const walk = (text: string): void => {
    // Both readings: with comments skipped and without (see substitutionSpans).
    for (const skip of [false, true]) {
      for (const span of substitutionSpans(text, skip)) {
        if (walked.has(span.inner)) continue;
        walked.add(span.inner);
        bodies.add(blankSubstitutions(span.inner));
        walk(span.inner);
      }
    }
  };
  walk(command);
  return [...bodies];
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
  if (!scans.some((s) => s.targets.length > 0)) return [];
  const dirs = new Set<string>([cwd]);
  for (const s of scans) {
    for (const d of s.seen) dirs.add(d);
    for (const t of s.targets) dirs.add(t);
  }
  return [...dirs];
}

/**
 * Every reading of a command: substitutions blanked, raw, each substitution body, and every nested
 * shell script read the same way. A script in single quotes is inert text to the outer shell, so its
 * substitutions only come out when the script itself is read as a command. No depth cap: a nested
 * script is a strict substring of its parent, so the recursion ends.
 */
function readingsOf(command: string): string[] {
  const own = [blankSubstitutions(command), blankSubstitutions(command, true), command, ...substitutionBodies(command)];
  return [...own, ...nestedShellBodies(command).filter((body) => body.length < command.length).flatMap((body) => readingsOf(body))];
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

/**
 * One reading of a command: every clean-install target in it (`target` is the first, or null) and every
 * directory it passed through. The whole command is scanned, never stopped at the first install.
 */
function scan(command: string, cwd: string, home: string): { target: string | null; targets: string[]; seen: string[]; cdArgs: string[] } {
  const seen: string[] = [cwd];
  const targets: string[] = [];
  // Every directory word the scan met (cd, env -C, --prefix), as written, for the uncertain-parse check.
  const cdArgs: string[] = [];
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
    const words = shellWords(segment);
    if (words.length === 2 && words[0] === 'cd') {
      cdArgs.push(words[1]);
      dir = resolveDir(dir, words[1], home);
      seen.push(dir);
      restore();
      continue;
    }
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
          cdArgs.push(words[start]);
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
      // Words are already read as the shell reads them; no second unquote.
      if (t.startsWith('--prefix=')) prefix = t.slice('--prefix='.length);
      else if (PREFIX_FLAGS.has(t) && i + 1 < tokens.length) prefix = tokens[++i];
      else if (VALUE_FLAGS.has(t)) i++;
      else if (!t.startsWith('-') && sub === null) sub = t;
    }
    if (prefix !== null) {
      cdArgs.push(prefix);
      seen.push(resolveDir(cmdDir, prefix, home));
    }
    if (sub !== null && CLEAN_INSTALL.has(sub)) {
      // Keep scanning: a later clean install (after a cd into a linked worktree, say) must
      // not be hidden by an earlier one in a directory that is safe (Vercel Security Review,
      // row 16 finding 5). Every target is collected and every directory the scan passes
      // through is still recorded.
      targets.push(prefix === null ? cmdDir : resolveDir(cmdDir, prefix, home));
    }
    restore();
  }
  return { target: targets[0] ?? null, targets, seen, cdArgs };
}

/**
 * Text the line-and-regex reader cannot place with certainty (row 16 fix round 1). A subshell
 * parenthesis next to a quote, a backslash, a comment, a heredoc or a `case` pattern can be a
 * literal parenthesis that the segment reader mistakes for a subshell exit (or the reverse), so
 * a later relative cd resolves against the wrong base. The guard does not guess there.
 */
export function npmCiParseIsUncertain(command: string): boolean {
  return command.includes('(') && /['"\\#]|<<|\bcase\b/.test(command);
}

/**
 * For an uncertain parse: every directory the command could reach. The cwd, every directory any
 * reading passed through, and every directory word the command names (cd, env -C, --prefix)
 * taken against each of those, since the reading that resolved a relative cd against the wrong
 * base is the one that cannot be trusted. Over-collects on purpose.
 */
export function npmCiUncertainDirs(command: string, cwd: string, home: string = process.env.HOME ?? ''): string[] {
  const scans = readingsOf(command).map((text) => scan(text, cwd, home));
  const bases = new Set<string>([cwd]);
  for (const s of scans) for (const d of s.seen) bases.add(d);
  const dirs = new Set<string>(bases);
  for (const s of scans) {
    for (const arg of s.cdArgs) for (const b of bases) dirs.add(resolveDir(b, arg, home));
  }
  return [...dirs];
}

/** True when any reading of the command has a directory word (cd, env -C, --prefix) that is not absolute. */
export function npmCiHasRelativeCd(command: string, cwd: string, home: string = process.env.HOME ?? ''): boolean {
  return readingsOf(command)
    .map((text) => scan(text, cwd, home))
    .some((s) => s.cdArgs.some((arg) => !isAbsolute(expandHome(arg, home))));
}

/** Where the search for a reachable link starts: the cwd, every directory a reading saw, and the repo's .worktrees. */
function uncertainSearchRoots(command: string, cwd: string, deps: NpmCiSymlinkGuardDeps, home: string): string[] {
  const roots = new Set<string>(npmCiUncertainDirs(command, cwd, home));
  const list = deps.listSubdirs;
  if (list !== undefined) {
    // The repo's .worktrees directory: the nearest one above the cwd (a worktree sits inside it).
    let dir = cwd;
    for (let up = 0; up < 8; up++) {
      const candidate = join(dir, '.worktrees');
      if (list(candidate).length > 0) {
        roots.add(candidate);
        break;
      }
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
  return [...roots];
}

/** The search is bounded so a huge tree cannot stall the hook; when the bound is hit the guard asks. */
const SEARCH_MAX_DEPTH = 6;
const SEARCH_MAX_DIRS = 6000;
const SEARCH_SKIP = new Set(['node_modules', '.git']);

/**
 * Breadth-first search below `roots` for a directory whose node_modules is a symlink. Never enters
 * node_modules or .git. Reports whether it hit its bound before it finished.
 */
function findLinkedBelow(roots: string[], deps: NpmCiSymlinkGuardDeps): { found: string | undefined; truncated: boolean } {
  const list = deps.listSubdirs;
  const queue: Array<{ dir: string; depth: number }> = roots.map((dir) => ({ dir, depth: 0 }));
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { dir, depth } = queue.shift() as { dir: string; depth: number };
    if (visited.has(dir)) continue;
    if (visited.size >= SEARCH_MAX_DIRS) return { found: undefined, truncated: true };
    visited.add(dir);
    const modules = join(dir, 'node_modules');
    if (deps.isSymlink(modules)) return { found: modules, truncated: false };
    if (list === undefined) continue;
    if (depth >= SEARCH_MAX_DEPTH) {
      if (list(dir).some((name) => !SEARCH_SKIP.has(name))) return { found: undefined, truncated: true };
      continue;
    }
    for (const name of list(dir)) {
      if (!SEARCH_SKIP.has(name)) queue.push({ dir: join(dir, name), depth: depth + 1 });
    }
  }
  return { found: undefined, truncated: false };
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
  // The fast exit reads the loose text, so `n\pm` and `np''m` still enter (b137 P2 on #5195).
  if (typeof command !== 'string' || !shellWord(command).includes('npm')) return outputSilentSuccess();

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
  if (linked === undefined) {
    // A clean install is in the command and no reading found a linked directory. When the text
    // is one the reader cannot place with certainty, ask if any directory it could reach is
    // linked, instead of trusting the reading (row 16 fix round 1).
    if (npmCiParseIsUncertain(command)) {
      const reachable = npmCiUncertainDirs(command, cwd)
        .map((d) => join(d, 'node_modules'))
        .find((m) => deps.isSymlink(m));
      if (reachable !== undefined) {
        ctx.log(HOOK_NAME, `asked about an uncertain parse near symlinked ${reachable}`);
        return outputAsk(
          `This command runs a clean install (npm ci) in a form the npm ci guard cannot read with certainty (a parenthesis next to a quote, a backslash, a comment, a heredoc or a case pattern), and ${reachable} is a symlink the command may reach. ` +
            'If it runs npm ci there, it empties the linked tree (the main repository in a reclaimed worktree). Use npm install instead, or split the command so each directory change is its own plain line.',
        );
      }
      // Ruling B (row 16 fix round 2): with a relative cd in an uncertain parse, no resolution of
      // the cd chain is trusted, so ask whenever ANY link is reachable: below the repo's
      // .worktrees, the cwd or any directory a reading saw. No depth to get wrong.
      if (npmCiHasRelativeCd(command, cwd)) {
        const { found, truncated } = findLinkedBelow(uncertainSearchRoots(command, cwd, deps, process.env.HOME ?? ''), deps);
        if (found !== undefined || truncated) {
          const where = found !== undefined ? `${found} is a symlink the command may reach` : 'the search for a linked node_modules was cut short';
          ctx.log(HOOK_NAME, `asked about an uncertain parse with a relative cd: ${where}`);
          return outputAsk(
            `This command runs a clean install (npm ci) after relative directory changes in a form the npm ci guard cannot read with certainty (a parenthesis next to a quote, a backslash, a comment, a heredoc or a case pattern), and ${where}. ` +
              'If it runs npm ci there, it empties the linked tree (the main repository in a reclaimed worktree). Use npm install instead, or split the command so each directory change is its own plain line.',
          );
        }
      }
    }
    return outputSilentSuccess();
  }
  const modules = linked;

  ctx.log(HOOK_NAME, `denied clean install through symlinked ${modules}`);
  return outputDeny(
    `npm ci would empty the shared tree: ${modules} is a symlink, and npm ci deletes node_modules by following it, ` +
      'which empties the linked tree (the main repository in a reclaimed worktree) and breaks every worktree that shares it. ' +
      'Use npm install here instead: it replaces the link with a real directory and leaves the shared tree alone.',
  );
}
