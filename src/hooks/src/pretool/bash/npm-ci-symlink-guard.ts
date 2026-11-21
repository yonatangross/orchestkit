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
const CLEAN_INSTALL = new Set([
  'ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'clean-install-test', 'sit',
  // Spellings npm also resolves to those commands (checked against npm's own help output).
  'install-ci-test', 'install-ci', 'install-cl', 'isntall-c', 'clean-install-t',
  'cleanInstall', 'installClean', 'isntallClean', 'installCiTest', 'cleanInstallTest',
]);

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
const WRAPPERS = new Set(['env', 'time', 'command', 'exec', 'nohup', 'nice', 'sudo', 'doas', 'timeout', 'npx', 'xargs', 'setsid', 'builtin']);

/** Per wrapper, the options that take the next word as their value (#5169). */
const WRAPPER_VALUE_OPTIONS: Record<string, Set<string>> = {
  nice: new Set(['-n', '--adjustment']),
  sudo: new Set(['-u', '-g', '-C', '-D', '-h', '-p', '-r', '-t', '-U']),
  doas: new Set(['-u', '-C']),
  env: new Set(['-u', '--unset', '-S', '--split-string']),
  timeout: new Set(['-s', '--signal', '-k', '--kill-after']),
  xargs: new Set(['-n', '-I', '-L', '-P', '-s', '-d', '-E', '-a', '--max-args', '--max-procs', '--max-lines', '--delimiter', '--arg-file']),
  npx: new Set(['-p', '--package']),
};

/** The shells whose `-c <script>` argument is read as one more command, by the name of the program. */
const SHELL_NAMES = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

/** Options `cd` and `pushd` accept before the directory. */
const CD_OPTIONS = new Set(['-L', '-P', '-e', '-@', '--']);

/** Builtins that set variables for the rest of the command line. */
const DECLARE_WORDS = new Set(['export', 'declare', 'typeset', 'readonly', 'local']);

/**
 * Stands for a word the reader cannot know (a command substitution, an unset variable). Any word
 * holding it, `$` or a backtick is dynamic: the guard asks about it where a link is at stake.
 */
const DYNAMIC = '\u0001';

/** The last path segment of a command word: `/usr/local/bin/npm` is `npm`. */
function baseName(word: string): string {
  return word.slice(word.lastIndexOf('/') + 1);
}

function isDynamicWord(word: string): boolean {
  return word.includes(DYNAMIC) || /[$`]/.test(word);
}

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
  // A backslash before a newline joins the two lines: `n\<newline>pm` is npm.
  return word.replace(/\\\n/g, '').replace(/\\(.)/g, '$1').replace(/["']/g, '');
}

/** What `$'...'` reads for a backslash and the character after it. */
const ANSI_C_SIMPLE: Record<string, string> = {
  a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?',
};

/**
 * The text of an ANSI-C quoted word (`$'...'`), from just past the opening quote: `\x63`, `\143`,
 * `c`, `\n` and the other escapes become their characters. Returns where it ended.
 */
function readAnsiC(text: string, start: number): { value: string; end: number } {
  let out = '';
  let i = start;
  while (i < text.length && text[i] !== "'") {
    const c = text[i];
    const n = text[i + 1];
    if (c !== '\\' || n === undefined) {
      out += c;
      i++;
    } else if (n in ANSI_C_SIMPLE) {
      out += ANSI_C_SIMPLE[n];
      i += 2;
    } else if (n === 'x' || n === 'u' || n === 'U') {
      const max = n === 'x' ? 2 : n === 'u' ? 4 : 8;
      const digits = /^[0-9a-fA-F]+/.exec(text.slice(i + 2, i + 2 + max))?.[0] ?? '';
      const code = digits === '' ? -1 : parseInt(digits, 16);
      out += code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : `\\${n}${digits}`;
      i += 2 + digits.length;
    } else if (n >= '0' && n <= '7') {
      const digits = /^[0-7]{1,3}/.exec(text.slice(i + 1, i + 4))?.[0] ?? n;
      out += String.fromCharCode(parseInt(digits, 8) & 0xff);
      i += 1 + digits.length;
    } else if (n === 'c' && i + 2 < text.length) {
      out += String.fromCharCode(text.charCodeAt(i + 2) & 0x1f);
      i += 3;
    } else {
      out += `\\${n}`;
      i += 2;
    }
  }
  return { value: out, end: i < text.length ? i + 1 : i };
}

/**
 * One shell word from `start` (not a blank): quotes, escapes and `$'...'` read the way the shell
 * reads them. It ends at an unquoted blank, at an unquoted `<` or `>` (a redirection is not part of
 * the word next to it) or at a character of `stops`.
 */
function readWord(text: string, start: number, stops: string): { value: string; end: number; hasExpand: boolean; splits: boolean } {
  let cur = '';
  let i = start;
  // Whether bash expands anything in this word, and whether an expansion sits
  // outside all quoting so its result splits on IFS (reviews on #5336).
  let hasExpand = false;
  let splits = false;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c) || c === '<' || c === '>' || stops.includes(c)) break;
    if (c === "'") {
      const end = text.indexOf("'", i + 1);
      cur += end === -1 ? text.slice(i + 1) : text.slice(i + 1, end);
      i = end === -1 ? text.length : end + 1;
    } else if (c === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length && DQ_ESCAPABLE.includes(text[i + 1])) {
          // Inside double quotes a backslash before a newline vanishes with it.
          if (text[i + 1] !== '\n') cur += text[i + 1];
          i += 2;
        } else {
          if (text[i] === '$' || text[i] === '`') hasExpand = true;
          cur += text[i++];
        }
      }
      i++;
    } else if (c === '$' && text[i + 1] === "'") {
      const ansi = readAnsiC(text, i + 2);
      cur += ansi.value;
      i = ansi.end;
    } else if (c === '$' && text[i + 1] === '"') {
      // $"..." is a double-quoted word; the quote is read on the next turn.
      i++;
    } else if (c === '\\' && i + 1 < text.length) {
      if (text[i + 1] !== '\n') cur += text[i + 1];
      i += 2;
    } else {
      if (c === '$' || c === '`') {
        hasExpand = true;
        splits = true;
      }
      cur += c;
      i++;
    }
  }
  return { value: cur, end: i, hasExpand, splits };
}

/** `${IFS}`, `${IFS%?}`, `$IFS$9` and a bare `$IFS`: the shell splits words at them. */
// The text inside the braces may hold `$` or `{` (`${IFS:-$x}`), but the scan from one `${IFS` stops
// at the next one, so a run of unclosed openers is linear.
const IFS_BLANK = /\$\{IFS(?:(?!\$\{IFS)[^}])*\}|\$IFS\$\d|\$IFS(?![A-Za-z0-9_])/g;



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
function shellWords(segment: string): Array<{ value: string; hasExpand: boolean; splits: boolean }> {
  const words: Array<{ value: string; hasExpand: boolean; splits: boolean }> = [];
  let i = 0;
  // Where the last word ended, where it began in the segment (a quoted fd number is not one),
  // and whether the next word is the target of a redirection.
  let lastEnd = -1;
  let lastStart = -1;
  let dropNext = false;
  while (i < segment.length) {
    const c = segment[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '&' && segment[i + 1] === '>') {
      // `&>`/`&>>` redirects both streams as one operator: the `&` is part of
      // the redirection, not an argument, and the target word is not either.
      i++;
      while (i < segment.length && (segment[i] === '<' || segment[i] === '>')) i++;
      dropNext = true;
      continue;
    }
    if (c === '<' || c === '>') {
      // A redirection: the operator, an fd number glued before it, and its target word are not arguments.
      // The fd number must be unquoted digits: `'3'>x` keeps `3` as an argument (row 17, #59).
      if (lastEnd === i && lastStart !== -1 && /^\d/.test(segment[lastStart]) && /^\d+$/.test(words[words.length - 1]?.value ?? '')) {
        words.pop();
      }
      while (i < segment.length && (segment[i] === '<' || segment[i] === '>')) i++;
      dropNext = true;
      continue;
    }
    const wStart = i;
    const word = readWord(segment, i, '');
    i = word.end;
    if (dropNext) dropNext = false;
    else {
      words.push({ value: word.value, hasExpand: word.hasExpand, splits: word.splits });
      lastEnd = i;
      lastStart = wStart;
    }
  }
  return words;
}

/**
 * The commands of a text as lists of words, split at the separators the shell splits at when they
 * are not quoted (newline, `;`, `&`, `|`, parentheses). Used to find the scripts a command hands to
 * another shell; the reader above stays line-and-regex.
 */
function lexCommands(text: string): string[][] {
  const commands: string[][] = [];
  let words: string[] = [];
  let i = 0;
  let lastEnd = -1;
  let lastStart = -1;
  let dropNext = false;
  const endCommand = (): void => {
    if (words.length > 0) commands.push(words);
    words = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (c === ' ' || c === '\t') {
      i++;
    } else if (c === '\n' || c === ';' || c === '|' || c === '(' || c === ')' ||
      // `&` separates commands, but the `&` of `>&`, `<&` and `&>` is part of a redirection (row 17, #58).
      (c === '&' && text[i - 1] !== '<' && text[i - 1] !== '>' && text[i + 1] !== '>')) {
      endCommand();
      dropNext = false;
      i++;
    } else if (c === '<' || c === '>') {
      if (lastEnd === i && lastStart !== -1 && /^\d/.test(text[lastStart]) && /^\d+$/.test(words[words.length - 1] ?? '')) {
        words.pop();
      }
      while (i < text.length && (text[i] === '<' || text[i] === '>')) i++;
      dropNext = true;
    } else if (c === '&') {
      // The `&` of `>&`, `<&` and `&>` is part of the redirection, not a separator.
      i++;
    } else {
      const wStart = i;
      const word = readWord(text, i, ';&|()\n');
      // A word that makes no progress (a lone backslash-newline) still moves the cursor on.
      i = word.end > i ? word.end : i + 1;
      if (dropNext) dropNext = false;
      else {
        words.push(word.value);
        lastEnd = i;
        lastStart = wStart;
      }
    }
  }
  endCommand();
  return commands;
}

/** Most words a brace expansion may produce before the word is read as dynamic. */
const BRACE_MAX = 256;
const BRACE_MAX_WORD = 512;

/**
 * Brace expansion: `c{i,}` is `ci` and `c`, and the shell hands both to the command as separate
 * words. Returns every word, or [DYNAMIC] when the expansion is too large to follow. A brace that is
 * not an expansion (`${x}`, no comma) is left alone. The shell does not expand quoted braces; the
 * quotes are gone by now, so a quoted one is read as an expansion (it can only add a candidate).
 */
function braceExpand(word: string): string[] {
  if (!word.includes('{') || word.length > BRACE_MAX_WORD) return [word];
  const out: string[] = [];
  const expand = (text: string): boolean => {
    for (let open = text.indexOf('{'); open !== -1; open = text.indexOf('{', open + 1)) {
      if (open > 0 && text[open - 1] === '$') continue;
      let depth = 0;
      const commas: number[] = [];
      let close = -1;
      for (let j = open; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') {
          depth--;
          if (depth === 0) {
            close = j;
            break;
          }
        } else if (text[j] === ',' && depth === 1) commas.push(j);
      }
      if (close === -1 || commas.length === 0) continue;
      const cuts = [open, ...commas, close];
      for (let k = 0; k < cuts.length - 1; k++) {
        const piece = text.slice(cuts[k] + 1, cuts[k + 1]);
        if (!expand(text.slice(0, open) + piece + text.slice(close + 1))) return false;
      }
      return true;
    }
    if (out.length >= BRACE_MAX) return false;
    out.push(text);
    return true;
  };
  return expand(word) ? out : [DYNAMIC];
}

/**
 * Variables the command sets in plain lines (`NPM=npm`, `export X=y`), so `$NPM ci` reads as
 * `npm ci`. A variable set twice to different values is unknown (null): the later line may sit in
 * the other branch of an if. Values are capped so a doubling assignment cannot grow without bound.
 */
type Vars = Map<string, string | null>;
const VAR_VALUE_MAX = 4096;

/**
 * Marks the value of a `declare -n ref=name` nameref: expanding $ref resolves the
 * variable it names, not the text it holds (row 17, #53).
 */
const NAMEREF = '\u0002';

function expandVars(word: string, vars: Vars, maybeUnset?: Set<string>): string {
  if (!word.includes('$')) return word;
  const lookupVar = (name: string, depth = 0): string | undefined => {
    const value = vars.get(name);
    if (typeof value !== 'string') return undefined;
    // A nameref holds the name of another variable; its expansion is that variable's value.
    if (!value.startsWith(NAMEREF)) return value;
    // A nameref chain may cycle (`declare -n r=r`): stop following it after a few hops.
    return depth < 8 ? lookupVar(value.slice(NAMEREF.length), depth + 1) ?? '' : '';
  };
  // A var assigned twice is set-but-unknown: its current value cannot be read
  // off the command, so `:-`/`-`/`:+` over it cannot be answered either. The
  // operand is marked dynamic and carries the name and the arg so every
  // candidate bash could land on is probed (reviews on #5336).
  const isUnknown = (n: string, depth = 0): boolean => {
    const v = vars.get(n);
    if (v === null) return true;
    if (typeof v === 'string' && v.startsWith(NAMEREF)) return depth < 8 && isUnknown(v.slice(NAMEREF.length), depth + 1);
    return false;
  };
  return word.replace(
    /\$\{(\w+)(:?[-+])([^}]*)\}|\$\{(\w+)\}|\$(\w+)/g,
    (whole, n1: string | undefined, op: string | undefined, arg: string | undefined, n2: string | undefined, n3: string | undefined) => {
      const name = n1 ?? n2 ?? n3 ?? '';
      const value = lookupVar(name);
      if (op !== undefined) {
        if (isUnknown(name) || maybeUnset?.has(name) === true) {
          // `${n+word}`/`${n:+word}` never read n's value: set(-nonempty) gives
          // the arg, otherwise nothing. An assignment sitting in a skipped
          // branch means the variable may also be unset, so the empty outcome
          // stays a candidate while its past values never become operands.
          if (op === '+' || op === ':+') return `${DYNAMIC}${DYNAMIC}${arg ?? ''}`;
          return `${DYNAMIC}${name}${DYNAMIC}${arg ?? ''}`;
        }
        // ${n-word}/${n:-word} use word when n is unset (:- also when empty);
        // ${n+word}/${n:+word} use word when n is set (:+ also nonempty).
        const nonEmpty = value !== undefined && value !== '';
        if (op === '-' || op === ':-') return value !== undefined && (op === '-' || nonEmpty) ? value : arg ?? '';
        return nonEmpty || (op === '+' && value !== undefined) ? arg ?? '' : '';
      }
      return value !== undefined ? value : whole;
    },
  );
}

function assignmentsOf(words: string[]): Array<[string, string]> | null {
  const isAssign = (w: string): boolean => /^[A-Za-z_]\w*=/.test(w);
  let rest = words;
  if (words.length > 0 && DECLARE_WORDS.has(words[0])) {
    rest = words.slice(1).filter((w) => !w.startsWith('-'));
  } else if (words.length === 0 || !words.every(isAssign)) {
    return null;
  }
  return rest.filter(isAssign).map((w) => [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)]);
}

function setVar(vars: Vars, all: Map<string, Set<string>>, name: string, value: string): void {
  const tooLong = value.length > VAR_VALUE_MAX;
  if (vars.has(name)) {
    if (vars.get(name) !== value || tooLong) vars.set(name, null);
  } else {
    vars.set(name, tooLong ? null : value);
  }
  // Every value the name ever held: a skipped or shadowed assignment still names a
  // directory the variable may carry (row 17, #52 and #55).
  let held = all.get(name);
  if (held === undefined) {
    held = new Set();
    all.set(name, held);
  }
  if (!tooLong) held.add(value);
}

/**
 * The segment with any unquoted comment cut off (row 17, #39): a `#` inside
 * quotes is an argument (`cd d '#x'` keeps both operands), one at a word start
 * and not inside quotes opens a comment. Cutting on the raw segment is needed
 * because words have lost their quoting by the time a `#` could be spotted.
 */
function cutAtComment(segment: string): string {
  let quote: string | null = null;
  // A `#` opens a comment only at a word boundary. An escaped blank keeps the
  // word open, so `cd /lw/Fix\ #42` holds two words and a `#` operand, not a
  // comment, and `\#` inside a word is literal text (reviews on #5336).
  let wordStart = true;
  for (let i = 0; i < segment.length; i++) {
    const c = segment[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      wordStart = false;
    } else if (c === '\\') {
      i++;
      wordStart = false;
    } else if (quote === '"') {
      if (c === '"') quote = null;
      wordStart = false;
    } else if (c === "'" || c === '"') {
      quote = c;
      // A quote may open or sit inside a word; either way the word is open.
      wordStart = false;
    } else if (/[ \t;&|()]/.test(c)) {
      // The shell's blank is space and tab: a carriage return, a non-breaking or
      // ideographic space does not close a word, and neither does a quoted #.
      wordStart = true;
    } else if (c === '#') {
      if (wordStart) return segment.slice(0, i);
      wordStart = false;
    } else {
      wordStart = false;
    }
  }
  return segment;
}

/**
 * Split a command into segments only at separators the shell sees outside
 * quotes: `;`, newline, `|`, `&&`, `||`, and a background `&` that is not part
 * of a `>&`, `<&` or `&>` redirection. A `;` inside quotes is data, not a
 * command boundary (`printf '%s' 'x; cd /decoy; x'` is one command); text that
 * later runs as a script is re-read by nestedScripts (reviews on #5336).
 * Backticks and `$( )` are not quote-contexts here on purpose: their contents
 * still run, so splitting inside them keeps the coverage it had.
 */
function splitTopLevel(text: string): Array<{ text: string; conditional: boolean }> {
  const segments: Array<{ text: string; conditional: boolean }> = [];
  let cur = '';
  let i = 0;
  // A segment after `||`, `&&`, `|` or `&` may not run (or runs in a subshell
  // whose assignments die with it), so its writes do not prove set-ness.
  let conditional = false;
  // An unquoted `#` at a word boundary is a comment through end of line: quote
  // characters inside it start nothing, so `cd d # don't` must not swallow the
  // commands on the next line into a quoted span (reviews on #5336).
  let wordStart = true;
  while (i < text.length) {
    const c = text[i];
    if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end === -1) {
        cur += text.slice(i);
        break;
      }
      cur += text.slice(i, end + 1);
      i = end + 1;
      wordStart = false;
    } else if (c === '"') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && i + 1 < text.length && DQ_ESCAPABLE.includes(text[i + 1])) i++;
        i++;
      }
      if (i < text.length) i++;
      cur += text.slice(start, i);
      wordStart = false;
    } else if (c === '$' && text[i + 1] === "'") {
      const ansi = readAnsiC(text, i + 2);
      cur += text.slice(i, ansi.end);
      i = ansi.end;
      wordStart = false;
    } else if (c === '$' && text[i + 1] === '{') {
      // ${...} is one word: a `#` or `;` inside its expansion is the
      // parameter's own text, never a comment or a command boundary.
      let depth = 1;
      let j = i + 2;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        else if (text[j] === "'") {
          const q = text.indexOf("'", j + 1);
          j = q === -1 ? text.length : q + 1;
        } else if (text[j] === '"') {
          j++;
          while (j < text.length && text[j] !== '"') {
            if (text[j] === '\\' && j + 1 < text.length && DQ_ESCAPABLE.includes(text[j + 1])) j++;
            j++;
          }
          if (j < text.length) j++;
        } else if (text[j] === '\\' && j + 1 < text.length) {
          j++;
        }
        j++;
      }
      cur += text.slice(i, j);
      i = j;
      wordStart = false;
    } else if (c === '\\' && i + 1 < text.length) {
      cur += text.slice(i, i + 2);
      i += 2;
      wordStart = false;
    } else if (c === '#' && wordStart) {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === ';' || c === '\n' || c === '|' || (c === '&' && text[i - 1] !== '<' && text[i - 1] !== '>' && text[i + 1] !== '>')) {
      segments.push({ text: cur, conditional });
      cur = '';
      conditional = c === '|' || c === '&';
      // `||` and `&&` are one separator each.
      if ((c === '|' || c === '&') && text[i + 1] === c) i++;
      i++;
      wordStart = true;
    } else {
      // Inside a word only space, tab and the subshell parens open a boundary.
      wordStart = /[ \t()]/.test(c);
      cur += c;
      i++;
    }
  }
  segments.push({ text: cur, conditional });
  return segments;
}

/** A segment whose command is cd or pushd (after assignments and `builtin`/`command`). */
const CD_SEGMENT = /^(?:[A-Za-z_]\w*=\S+\s+)*(?:(?:builtin|command)\s+)*(?:cd|pushd)(?:\s|$)/;

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
/**
 * Work budget for reading one command. A command past it is not read further: the guard asks
 * when the text mentions a clean install (fails closed), instead of stopping quietly, running out
 * of stack (the dispatcher's catch would let the command through) or stalling the hook.
 */
const PARSE_MAX_SPANS = 4000;
const PARSE_MAX_CHARS = 200_000;
const PARSE_MAX_WORK = 2_000_000;
const PARSE_MAX_UNCLOSED = 64;
const PARSE_MAX_READ_WORK = 2_000_000;
class ParseBudgetExceeded extends Error {}

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
  // Each unclosed opener is a scan to the end of the text; many of them cost length squared.
  let unclosed = 0;
  const stepOverUnclosed = (): void => {
    if (++unclosed > PARSE_MAX_UNCLOSED) throw new ParseBudgetExceeded();
  };
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
    } else if ((c === '$' || ((c === '<' || c === '>') && !inDouble)) && text[i + 1] === '(') {
      // `$(...)`, and the process substitutions `<(...)` and `>(...)`, which run their body too.
      const end = closeOfParen(text, i + 1);
      if (end === -1) {
        stepOverUnclosed();
        i += 2;
        continue;
      }
      spans.push({ start: i, end, inner: text.slice(i + 2, end - 1) });
      i = end;
    } else if (c === '`') {
      const end = closeOfBacktick(text, i);
      if (end === -1) {
        stepOverUnclosed();
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
    out += `${command.slice(last, span.start)}${DYNAMIC}`;
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

/**
 * The scripts a command hands to another shell, read from the words the shell would pass: the
 * argument of `-c` for any shell (by program name, so a path works, with options before the flag and
 * a `--` after it), the words after `eval`, and what `npm exec` and `npx` run. The regex above stays
 * as a second reading; this one follows quoting, so an escaped quote inside a double-quoted script
 * and a quote closed and reopened (`'\''`) come out as the script the inner shell receives.
 */
function nestedScripts(text: string): string[] {
  const scripts: string[] = [];
  for (const words of lexCommands(text)) {
    // The words after the first eval and the first npm or npx are joined whole; a second one in the
    // same command is inside that text and is read when the text is read. That keeps a long run of
    // `eval eval eval ...` from joining the rest of the line once per word.
    let sawEval = false;
    let sawNpm = false;
    for (let k = 0; k < words.length; k++) {
      const name = baseName(words[k]);
      if (SHELL_NAMES.has(name)) {
        // Options come before the flag: `bash -o pipefail -e -c script`. Bounded look-ahead.
        const last = Math.min(words.length, k + 1 + SHELL_OPTIONS_MAX);
        let flag = -1;
        for (let j = k + 1; j < last; j++) {
          if (SHELL_C_FLAG.test(words[j])) {
            flag = j;
            break;
          }
        }
        if (flag === -1) continue;
        const at = words[flag + 1] === '--' ? flag + 2 : flag + 1;
        if (at < words.length) scripts.push(words[at]);
      } else if (name === 'eval') {
        if (!sawEval && k + 1 < words.length) scripts.push(words.slice(k + 1).join(' '));
        sawEval = true;
      } else if (name === 'npm' || name === 'npx') {
        if (sawNpm) continue;
        sawNpm = true;
        const rest = words.slice(k + 1);
        const subcommand = rest.find((w) => !w.startsWith('-'));
        if (name === 'npm' && subcommand !== 'exec' && subcommand !== 'x') continue;
        const dashes = rest.indexOf('--');
        if (dashes !== -1 && dashes + 1 < rest.length) scripts.push(rest.slice(dashes + 1).join(' '));
        const call = rest.findIndex((w) => w === '-c' || w === '--call' || w.startsWith('--call='));
        if (call !== -1) {
          const script = rest[call].startsWith('--call=') ? rest[call].slice('--call='.length) : rest[call + 1];
          if (script !== undefined) scripts.push(script);
        }
      }
    }
  }
  return scripts;
}

const SHELL_C_FLAG = /^-[A-Za-z]*c[A-Za-z]*$/;
const SHELL_OPTIONS_MAX = 12;

/** A heredoc operator: `<<EOF`, `<<-EOF`, `<<'EOF'`, `<<"EOF"`, but not the here-string `<<<`. */
const HEREDOC_OPERATOR = /(?<!<)<<(-?)\s*(?:'([^'\n]*)'|"([^"\n]*)"|\\?([\w.-]+))/g;

/**
 * The command with its heredoc bodies cut out, and the bodies. The body of a quoted-delimiter
 * heredoc is literal text, and an apostrophe or backtick in it must not pair with one in the command
 * after it. Read as an extra reading beside the others, so a misplaced cut can only add candidates.
 */
function splitHeredocs(text: string): { rest: string; bodies: string[] } {
  if (!text.includes('<<')) return { rest: text, bodies: [] };
  const keep: string[] = [];
  const bodies: string[] = [];
  const pending: Array<{ delimiter: string; stripTabs: boolean }> = [];
  let body: string[] = [];
  for (const line of text.split('\n')) {
    if (pending.length > 0) {
      const { delimiter, stripTabs } = pending[0];
      if ((stripTabs ? line.replace(/^\t+/, '') : line) === delimiter) {
        pending.shift();
        bodies.push(body.join('\n'));
        body = [];
      } else {
        body.push(line);
      }
      continue;
    }
    keep.push(line);
    for (const m of line.matchAll(HEREDOC_OPERATOR)) {
      pending.push({ delimiter: m[2] ?? m[3] ?? m[4] ?? '', stripTabs: m[1] === '-' });
    }
  }
  if (pending.length > 0 && body.length > 0) bodies.push(body.join('\n'));
  return { rest: keep.join('\n'), bodies };
}

/** Bodies of every $(...) and `...` in the command, nested ones included, each with its own substitutions blanked. */
function substitutionBodies(command: string): string[] {
  const bodies = new Set<string>();
  // No depth cap (a cap that stops quietly fails open): every body is strictly shorter than the
  // text it came from, so the walk ends; the set keeps repeated bodies from being walked twice.
  // Dedup on the RAW inner text: blanked bodies of different nesting levels can be equal (one placeholder),
  // and skipping on those would stop the walk before the innermost body. Iterative, under a work
  // budget: past it the command is too complex to read and the guard fails closed (ParseBudgetExceeded).
  const walked = new Set<string>();
  const stack = [command];
  let work = 0;
  while (stack.length > 0) {
    const text = stack.pop() as string;
    // Each body is rescanned on its own, so nesting costs about depth x length: bound the total.
    work += text.length;
    if (work > PARSE_MAX_WORK) throw new ParseBudgetExceeded();
    // Both readings: with comments skipped and without (see substitutionSpans).
    for (const skip of [false, true]) {
      for (const span of substitutionSpans(text, skip)) {
        if (walked.has(span.inner)) continue;
        if (walked.size >= PARSE_MAX_SPANS) throw new ParseBudgetExceeded();
        walked.add(span.inner);
        bodies.add(blankSubstitutions(span.inner));
        stack.push(span.inner);
      }
    }
  }
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
  if (lastReadings?.command === command) return lastReadings.readings;
  const readings = readAllWays(command);
  lastReadings = { command, readings };
  return readings;
}

/** The guard asks for the readings of one command several times; the last result is kept. */
let lastReadings: { command: string; readings: string[] } | undefined;

/** Characters a command may use to hide what it runs: a variable, a substitution, a brace expansion. */
const MAY_BE_DYNAMIC = /[$`{]/;

function readAllWays(command: string): string[] {
  if (command.length > PARSE_MAX_CHARS) throw new ParseBudgetExceeded();
  const readings: string[] = [];
  const stack = [command];
  // Every text is read once: the two script readers, the line joiner and the heredoc cutter often
  // hand back the same text, and a repeat at each depth would double the walk.
  const queued = new Set<string>(stack);
  let scripts = 0;
  let work = 0;
  const enqueue = (next: string, parent: string): void => {
    if (next.length >= parent.length || queued.has(next)) return;
    queued.add(next);
    if (++scripts > PARSE_MAX_SPANS) throw new ParseBudgetExceeded();
    stack.push(next);
  };
  while (stack.length > 0) {
    const text = stack.pop() as string;
    // Each text is read in full, so a chain of scripts that each drop one word costs length squared.
    work += text.length;
    if (work > PARSE_MAX_READ_WORK) throw new ParseBudgetExceeded();
    const bodies = substitutionBodies(text);
    readings.push(blankSubstitutions(text), blankSubstitutions(text, true), text, ...bodies);
    for (const body of nestedShellBodies(text)) enqueue(body, text);
    for (const source of [text, ...bodies]) {
      for (const script of nestedScripts(source)) enqueue(script, text);
    }
    // A backslash before a newline joins the lines: `npm \<newline>ci` is `npm ci`.
    enqueue(text.replace(/\\\n/g, ''), text);
    const heredocs = splitHeredocs(text);
    if (heredocs.bodies.length > 0) {
      enqueue(heredocs.rest, text);
      for (const body of heredocs.bodies) enqueue(body, text);
    }
  }
  return readings;
}

/**
 * The fail-safe half (#5169). When no reading finds a clean install but the
 * text still holds `npm` and, later, a clean-install word (after quotes and
 * escapes are removed), return the cwd and every directory any reading passed
 * through, so the guard can ask instead of failing open. [] otherwise.
 */
export function npmCiMentionDirs(command: string, cwd: string, home: string = process.env.HOME ?? ''): string[] {
  const words = shellWord(command).split(/[\s;&|()]+/).filter(Boolean);
  const npmAt = words.findIndex((w) => baseName(w) === 'npm');
  const mentioned = npmAt !== -1 && words.slice(npmAt + 1).some((w) => CLEAN_INSTALL.has(w));
  // A command or subcommand the reader could not resolve (`$NPM ci`, `npm $SUB`) counts as a mention.
  if (!mentioned && !MAY_BE_DYNAMIC.test(command)) return [];
  const scans = readingsOf(command).map((text) => scan(text, cwd, home));
  if (!mentioned && !scans.some((s) => s.dynamic)) return [];
  const dirs = new Set<string>([cwd]);
  for (const s of scans) for (const d of s.seen) dirs.add(d);
  return [...dirs];
}

/**
 * One reading of a command: every clean-install target in it (`target` is the first, or null) and every
 * directory it passed through. The whole command is scanned, never stopped at the first install.
 */
function scan(command: string, cwd: string, home: string): { target: string | null; targets: string[]; seen: string[]; cdArgs: string[]; dynamic: boolean; dirShaky: boolean } {
  const seen: string[] = [cwd];
  const targets: string[] = [];
  // Every directory word the scan met (cd, env -C, --prefix), as written, for the uncertain-parse check.
  const cdArgs: string[] = [];
  // True when a segment may be a clean install the reader cannot place: the command word or the
  // subcommand is a variable or substitution it cannot resolve.
  let dynamic = false;
  // True when a directory change may have landed elsewhere than the reading assumes (row 17):
  // a multi-operand or metachar-heavy cd, an operand the reader cannot expand, CDPATH.
  let dirShaky = false;
  let varsNow: Vars = new Map();
  const varsAll = new Map<string, Set<string>>();
  // Variables whose every assignment sits in a conditional or piped segment:
  // they may be unset at the expansion, so `+`/`:+` forms keep the empty
  // outcome and `-`/`:-` keep the default alongside the value (round 3).
  const maybeUnset = new Set<string>();
  let dir = cwd;
  // A subshell runs in a copy of the shell: a cd and an assignment inside it end
  // when it closes. Each '(' saves the directory and the variables (#55).
  const saved: Array<{ dir: string; vars: Vars }> = [];
  // Unpack a `DYNAMIC name DYNAMIC arg` expansion: the variable's history plus
  // the arg are the directories bash could use. An empty name (the `+`/`:+`
  // forms) contributes only the arg; the variable's past values never become
  // operands there (reviews on #5336).
  const dynamicCandidates = (v: string): string[] | null => {
    if (!v.includes(DYNAMIC)) return null;
    const parts = v.split(DYNAMIC);
    if (parts.length < 3 || parts[0] !== '') return null;
    const out: string[] = [];
    if (parts[1] !== '') out.push(...(varsAll.get(parts[1]) ?? []));
    for (const a of parts.slice(2)) if (a !== '') out.push(a);
    return out;
  };
  const probeDir = (base: string, v: string): void => {
    // A marked expansion resolves to one of its candidates; a plain value is
    // one candidate itself. Tildes read the shell's HOME, never a
    // command-local one (`HOME=/h cd ~` expands before the assignment).
    const cands = dynamicCandidates(v);
    if (cands !== null) dirShaky = true;
    for (const c of cands ?? [v]) {
      cdArgs.push(c);
      seen.push(resolveDir(base, c, home));
    }
  };
  for (const rawSeg of splitTopLevel(command)) {
    let segment = rawSeg.text.trim();
    const opens = /^\(+/.exec(segment)?.[0].length ?? 0;
    segment = segment.slice(opens).trim();
    // Counted from the end: a regex for a trailing run rescans the whole run from each of its starts.
    let closes = 0;
    while (closes < segment.length && segment[segment.length - 1 - closes] === ')') closes++;
    segment = segment.slice(0, segment.length - closes).trim();
    for (let n = 0; n < opens; n++) {
      saved.push({ dir, vars: varsNow });
      // The subshell's variable map is a copy: an assignment or a CDPATH change
      // inside it must not leak into the parent shell (reviews on #5336).
      varsNow = new Map(varsNow);
    }
    const restore = () => {
      for (let n = 0; n < closes; n++) {
        const s = saved.pop();
        if (s !== undefined) {
          dir = s.dir;
          varsNow = s.vars;
        }
      }
    };
    // A brace group runs in the current shell, so `{ cd X; }` moves the
    // directory for what follows; only the grammar is stripped (#5169).
    // ${IFS} and $IFS (with an empty positional after it) are the blank the shell splits words at.
    segment = stripShellGrammar(segment).replace(IFS_BLANK, ' ');
    // The comment cut applies to cd and pushd only: on an npm line it would drop
    // words the shell keeps whenever this reader splits finer than the shell.
    if (CD_SEGMENT.test(segment)) segment = cutAtComment(segment);
    const rawWords = shellWords(segment);
    const assigned = assignmentsOf(rawWords.map((w) => w.value));
    if (assigned !== null) {
      // `declare -n r=x` makes r a nameref: expanding $r gives x's value, not "x" (#53).
      const isNameref =
        rawWords.length > 0 &&
        DECLARE_WORDS.has(rawWords[0].value) &&
        rawWords.slice(1).some((w) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(w.value));
      for (const [name, value] of assigned) {
        const expanded = expandVars(value, varsNow, maybeUnset);
        setVar(varsNow, varsAll, name, isNameref && /^[A-Za-z_]\w*$/.test(expanded) ? NAMEREF + expanded : expanded);
        // An assignment in a conditional or piped segment may not have run; an
        // unconditional one proves the variable is set.
        if (rawSeg.conditional) maybeUnset.add(name);
        else maybeUnset.delete(name);
      }
      restore();
      continue;
    }
    // Variables first: `cd $d` with d="a b" splits on IFS into `cd a b` (#36, #51).
    const ifsValue = varsNow.get('IFS');
    // An unset IFS defaults to space-tab-newline; an explicit `IFS=` is EMPTY
    // and disables word splitting, it does not reset the default (#5336).
    const ifs = typeof ifsValue === 'string' ? ifsValue : ' \t\n';
    const ifsSplit = new RegExp(`[${ifs.replace(/[\\\-\]^[]/g, '\\$&')}]+`);
    const words = rawWords.flatMap((w) => {
      const ex = w.hasExpand ? expandVars(w.value, varsNow, maybeUnset) : w.value;
      // Only an unquoted expansion splits on IFS: `cd "$d"` is one operand
      // even when $d holds blanks, and `IFS=` turns splitting off entirely.
      // An unquoted expansion that produces nothing drops the whole operand
      // (`cd $p` with p empty is bare `cd` into HOME) whether or not IFS is set.
      const pieces = !w.splits ? [ex] : ex === '' ? [] : ifs === '' ? [ex] : ex.split(ifsSplit).filter(Boolean);
      return pieces.flatMap((p) => {
        const parts = braceExpand(p);
        return parts.length === 1 && parts[0] === p ? parts : parts.filter((x) => x !== '');
      });
    });
    // `builtin cd` and `command cd` really change the directory (#41); assignments
    // and those two prefixes may stand between the start and the command word.
    let cdIdx = 0;
    while (cdIdx < words.length && /^\w+=/.test(words[cdIdx])) cdIdx++;
    while (cdIdx < words.length && (words[cdIdx] === 'builtin' || words[cdIdx] === 'command')) cdIdx++;
    const cdWord = cdIdx < words.length && (words[cdIdx] === 'cd' || words[cdIdx] === 'pushd');
    const cdOperands = cdWord ? words.slice(cdIdx + 1).filter((a) => !CD_OPTIONS.has(a)) : [];
    if (cdWord) {
      const beforeCd = dir;
      // `NAME=x cd sub` applies NAME to this one command and does not persist:
      // `CDPATH=/lw cd sub` resolves through /lw without leaking it into later
      // reads, and `HOME=/h cd` goes to /h (reviews on #5336).
      let cdVars = varsNow;
      if (cdIdx > 0) {
        cdVars = new Map(varsNow);
        for (const a of words.slice(0, cdIdx)) {
          const m = /^(\w+)=(.*)$/s.exec(a);
          if (m !== null) cdVars.set(m[1], expandVars(m[2], varsNow, maybeUnset));
        }
      }
      const cdHomeValue = cdVars.get('HOME');
      const cdHome = typeof cdHomeValue === 'string' ? cdHomeValue : home;
      // A command-local HOME that cannot be read still lands bare `cd` in one
      // of its candidates.
      if (typeof cdHomeValue === 'string' && cdHomeValue.includes(DYNAMIC)) probeDir(beforeCd, cdHomeValue);
      // Quotes, expansions and redirections around a cd are the shapes bash and this
      // reader disagree about (row 17); an operand count other than one is a cd bash
      // refuses (too many arguments) or a bare `cd`, which goes to the home directory.
      if (cdOperands.length !== 1 || /['"\\$`<>|#{}]/.test(segment)) dirShaky = true;
      if (cdOperands.length === 0) {
        if (words[cdIdx] === 'cd') dir = cdHome;
        seen.push(dir);
        restore();
        continue;
      }
      if (cdOperands.length !== 1) {
        // The operands may also be one quoted directory that holds blanks: probe the
        // joined form and the directory that stays if bash refuses (#38, #57, #58).
        seen.push(beforeCd);
        seen.push(resolveDir(beforeCd, cdOperands.join(' '), cdHome));
        restore();
        continue;
      }
      const op = cdOperands[0];
      cdArgs.push(op);
      if (isDynamicWord(op) || op.includes('{')) {
        // An expansion the reader cannot follow, or literal text: where the shell
        // lands is not knowable one way. Decode marked expansions first so a
        // quoted fallback holding a blank is not read as a literal directory.
        dirShaky = true;
        seen.push(beforeCd);
        seen.push(resolveDir(beforeCd, op, home));
        // A parameter form over a set-but-unknown var arrives as `DYNAMIC name
        // DYNAMIC arg`: bash may land on any value the var held or on the arg.
        // The `+`/`:+` forms carry an empty name and only the arg plus the
        // empty outcome.
        const dynParts = op.startsWith(DYNAMIC) ? op.slice(1).split(DYNAMIC) : null;
        const name = dynParts === null ? /^\$\{?(\w+)\}?$/.exec(op)?.[1] : dynParts[0] || undefined;
        if (name !== undefined || dynParts !== null) {
          // An empty expansion drops the operand: `cd` alone goes to the home directory.
          dir = cdHome;
          seen.push(cdHome);
          if (name !== undefined) {
            for (const v of varsAll.get(name) ?? []) {
              cdArgs.push(v);
              seen.push(resolveDir(beforeCd, v, home));
            }
          }
        }
        for (const v of dynParts?.slice(1) ?? []) {
          if (v !== '') {
            cdArgs.push(v);
            seen.push(resolveDir(beforeCd, v, home));
          }
        }
        restore();
        continue;
      }
      if (op.includes(' ') || op.includes('\t')) {
        // Expansion pieces were already split on IFS, so a blank inside the one
        // operand is a quoted name like "/my wt". The shell may still refuse it:
        // mark the parse shaky and probe the stayed-behind directory too.
        dirShaky = true;
        seen.push(beforeCd);
        dir = resolveDir(beforeCd, op, home);
        seen.push(dir);
        restore();
        continue;
      }
      dir = resolveDir(dir, op, home);
      // CDPATH: a relative cd may resolve under a CDPATH entry instead of the cwd
      // (#37). Bash never consults it for operands that start with `.`.
      const cdpath = cdVars.get('CDPATH');
      if (!isAbsolute(expandHome(op, home)) && !op.startsWith('.') && typeof cdpath === 'string' && cdpath !== '') {
        dirShaky = true;
        for (const entry of cdpath.split(':')) {
          if (entry === '') continue;
          for (const e of dynamicCandidates(entry) ?? [entry]) {
            seen.push(resolveDir(resolveDir(beforeCd, e, home), op, home));
          }
        }
      }
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
      const wrapper = baseName(w);
      if (!WRAPPERS.has(wrapper)) break;
      start++;
      const valueOptions = WRAPPER_VALUE_OPTIONS[wrapper] ?? new Set<string>();
      while (start < words.length && words[start].startsWith('-')) {
        const option = words[start++];
        if (wrapper === 'env' && (option === '-C' || option === '--chdir') && start < words.length) {
          const envDir = words[start++];
          probeDir(cmdDir, envDir);
          cmdDir = resolveDir(cmdDir, envDir, home);
          seen.push(cmdDir);
        } else if (valueOptions.has(option) && start < words.length) {
          start++;
        }
      }
      // timeout takes a duration before the command.
      if (wrapper === 'timeout' && start < words.length && /^\d/.test(words[start])) start++;
    }
    const tokens = words.slice(start);
    const commandIsNpm = tokens.length > 0 && baseName(tokens[0]) === 'npm';
    const commandIsDynamic = tokens.length > 0 && isDynamicWord(tokens[0]);
    if (!commandIsNpm && !commandIsDynamic) {
      restore();
      continue;
    }
    let prefix: string | null = null;
    let sub: string | null = null;
    let dynamicSub = false;
    for (let i = 1; i < tokens.length; i++) {
      const t = tokens[i];
      // Words are already read as the shell reads them; no second unquote.
      if (t.startsWith('--prefix=')) prefix = t.slice('--prefix='.length);
      else if (PREFIX_FLAGS.has(t) && i + 1 < tokens.length) prefix = tokens[++i];
      else if (VALUE_FLAGS.has(t)) i++;
      else if (!t.startsWith('-') && sub === null) {
        if (isDynamicWord(t)) dynamicSub = true;
        else sub = t;
      }
    }
    if (prefix !== null) probeDir(cmdDir, prefix);
    if (commandIsDynamic && !commandIsNpm) {
      // The command word is a variable or substitution the reader cannot resolve. A clean-install
      // word after it is the shape of `$NPM ci`: not certain, so it is recorded, not denied.
      if (sub !== null && CLEAN_INSTALL.has(sub)) {
        dynamic = true;
        seen.push(prefix === null ? cmdDir : resolveDir(cmdDir, prefix, home));
      }
      restore();
      continue;
    }
    if (sub === null && dynamicSub) {
      // `npm $SUB`: the subcommand cannot be read.
      dynamic = true;
      seen.push(prefix === null ? cmdDir : resolveDir(cmdDir, prefix, home));
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
  return { target: targets[0] ?? null, targets, seen, cdArgs, dynamic, dirShaky };
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
 * True when a reading saw a directory change whose real destination it cannot
 * pin down (row 17, #5336): a multi-operand cd bash refuses, an operand built
 * from an unexpandable variable, CDPATH, or a cd surrounded by the quoting and
 * redirection the shell and this reader treat differently. The uncertain path
 * then probes every directory word against every base the command passed.
 */
export function npmCiDirShaky(command: string, cwd: string, home: string = process.env.HOME ?? ''): boolean {
  return readingsOf(command)
    .map((text) => scan(text, cwd, home))
    .some((s) => s.dirShaky);
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
  // The fast exit reads the loose text, so `n\pm` and `np''m` still enter (b137 P2 on #5195). A
  // command with a variable, a substitution or a brace may build the name, so it enters too.
  if (typeof command !== 'string' || !(shellWord(command).includes('npm') || MAY_BE_DYNAMIC.test(command))) return outputSilentSuccess();

  const cwd = input.cwd || ctx.projectDir;
  try {
    return decide(command, cwd, ctx, deps);
  } catch (err) {
    // Too complex to read (the work budget, or a stack overflow in the quote-aware reader): never
    // let it through quietly. Ask when the text mentions a clean install; the check below reads
    // the words only, with no recursion.
    const words = shellWord(command).split(/[\s;&|()$`"']+/).filter(Boolean);
    const npmAt = words.findIndex((w) => baseName(w) === 'npm');
    if (npmAt === -1 || !words.slice(npmAt + 1).some((w) => CLEAN_INSTALL.has(w))) return outputSilentSuccess();
    ctx.log(HOOK_NAME, `asked: command too complex to read (${err instanceof ParseBudgetExceeded ? 'work budget' : String(err)})`);
    return outputAsk(
      'This command mentions npm ci (or another clean install) in a form too complex for the npm ci guard to read. ' +
        'If it runs npm ci where node_modules is a symlink, it empties the linked tree (the main repository in a reclaimed worktree). Use npm install instead, or split the command.',
    );
  }
}

function decide(command: string, cwd: string, ctx: HookContext, deps: NpmCiSymlinkGuardDeps): HookResult {
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
    // is one the reader cannot place with certainty, or a directory change may have landed
    // elsewhere than the reading assumes (row 17, #5336), ask if any directory it could reach
    // is linked, instead of trusting the reading (row 16 fix round 1).
    if (npmCiParseIsUncertain(command) || npmCiDirShaky(command, cwd)) {
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
