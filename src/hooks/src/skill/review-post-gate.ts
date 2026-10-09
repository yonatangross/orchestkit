/**
 * Review Post Gate (skill-scoped PreToolUse on Bash and Write|Edit|NotebookEdit,
 * /ork:review-pr only)
 *
 * #4675: /ork:review-pr posted a review nobody asked for. This gate makes
 * posting opt-in in code, not in prose. The GitHub write surface is an
 * allowlist (#4678 HOLDs at bce3afb6):
 *
 *   1. gh runs only its read verbs (pr view/diff/checks/list/status, issue
 *      view/list/status, repo view, run view/list/watch, search, auth status).
 *      `gh api` runs only as a plain GET: no method flag other than GET, no
 *      -f/-F/--field/--raw-field/--input (also in a short-flag cluster), and
 *      no graphql at all (a GET may carry -f/-F as query fields). Any curl,
 *      wget or httpie/xh call to a GitHub host is denied. Every other gh verb
 *      is denied while the skill runs.
 *   1b. Every segment that is not a known read (a read verb, or a direct gh
 *      read) is a write when it names a GitHub host, names gh as a word, or
 *      spells a gh write verb pair, read with every non-word character folded
 *      to spaces. A heredoc body counts as part of the command it feeds, and
 *      only a clean heredoc is split out (else the whole command is scanned);
 *      a heredoc into a receiver that is not a pure read is code, read whole.
 *      Each sh -c program is parsed first and checked as its own command.
 *      A segment with $( or a backtick is never a read; a shell reading
 *      stdin and eval are denied; a command that names post-review.mjs is
 *      its exact node call or a pure read with no redirect. One
 *      rule for any interpreter or wrapper (tsx, ipython, npx, bash -c), so
 *      neither its name nor the way it builds a list matters. A command that
 *      names a known interpreter is also read whole, newlines folded.
 *   2. The one write path is scripts/post-review.mjs, and only when:
 *      - the USER typed --post on the /ork:review-pr line that sits on this
 *        tool call's parentUuid chain (lib/review-opt-in.ts);
 *      - the call names, once, exactly the PR the user typed right after the
 *        command (a number, or the same full github.com pull URL); a bare
 *        number also needs the shell at the session project root, because gh
 *        resolves it against the cwd's repo;
 *      - the call runs the plugin's own copy, $CLAUDE_PLUGIN_ROOT/skills/
 *        review-pr/scripts/post-review.mjs, never a copy written elsewhere;
 *        with CLAUDE_PLUGIN_ROOT unset nothing posts, and Write/Edit may not
 *        touch the skill dir or any post-review.mjs;
 *      - the call is one plain command (letters, digits, - _ . / : and
 *        spaces), so the shell cannot hand the script a flag the text never
 *        spells: no quotes, escapes, globs, braces, $, backtick or chaining;
 *      - a call that names post-verdict or approve anywhere has
 *        --post-verdict typed by the user too;
 *      - the call sets no variable (TMPDIR, GH_REPO, GH_HOST and the like)
 *        and passes no --repo, so the PR number cannot point at another repo.
 *   3. Nothing in the skill may touch the transcripts dir (Bash text, or a
 *      Write/Edit file_path, naming .claude/projects), because the opt-in is
 *      read from there.
 *
 * Nothing here reads gh auth, so the gate holds with a full gh login.
 * Known limit: it reads the command TEXT. A post from a renamed copy of the
 * script, from a script file the model wrote first, or through a path built
 * at run time (including an in-place edit of the real transcript entry) is
 * not seen. It stops an over-eager post, not a model set on getting around
 * it; #4677 removes the write credential, which is the fail-closed layer.
 */

import type { HookContext, HookInput, HookResult } from '../types.js';
import { outputDeny, outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import { chainUserCommandArgs } from '../lib/review-opt-in.js';
import { posix } from 'node:path';

const HOOK = 'review-post-gate';
const SKILL_NAMES = ['/ork:review-pr'] as const;

// APFS folds case: Post-Review.mjs opens the same file.
const GUARD_SCRIPT = /\bpost-review\.mjs\b/i;
// The one form that runs the script: `node <path>/post-review.mjs ...`.
const GUARD_CALL = /^node\s+\S*\/post-review\.mjs(?:\s|$)/;
// A segment that only reads a file or history (cat the script, grep for
// "pr review", git log --grep, git grep): never a guard call, never a write.
// Only verbs with no flag that runs a command: no less/more (+!cmd); git grep
// counts only without its pager flag (gitGrepPager).
// sed counts only as one whole `sed -n 'N,Mp' <file>` (GNU sed's e runs a shell).
const READ_VERB =
  /^(?:cat|head|tail|wc|nl|ls|stat|file|diff|grep|egrep|fgrep|rg|test|git\s+(?:log|show|diff|blame|status|ls-files|cat-file|grep))(?:\s|$)/;
const READ_SED = /^sed\s+-n\s+(['"]?)\d+(?:,\d+)?p\1\s+[^\s;|&<>]+$/;
// Flags that make a read verb run a command: git grep -O/--open-files-in-pager,
// rg --pre/--pre-glob, git --ext-diff/--textconv, and --output (writes a file).
const EXEC_FLAG = /(?:^|\s)(?:-O\S*|--open-files-in-pager\S*|--pre(?:-glob)?(?:=|\s|$)|--ext-diff\b|--textconv\b|--output(?:=|\s|$))/;
const READ_FAMILY = /^(?:git|rg|grep|egrep|fgrep|sed|less|more)(?:\s|$)/;

/**
 * git grep runs a pager command from -O in any short cluster (-nO'cmd') or
 * from any unique prefix of --open-files-in-pager (--open=cmd, --op=cmd).
 */
function gitGrepPager(segment: string): boolean {
  if (!/^git\s+grep(?:\s|$)/.test(segment)) return false;
  return segment
    .replace(/['"\\]/g, '')
    .split(/\s+/)
    .some((t) => /^-[^-\s]*O/.test(t) || (/^--[a-z-]+/.test(t) && 'open-files-in-pager'.startsWith(t.slice(2).split('=')[0])));
}

/** A read verb with a flag that runs a command. The shell removes quotes first. */
function runsCommand(segment: string): boolean {
  return (READ_FAMILY.test(segment) && EXEC_FLAG.test(segment.replace(/['"\\]/g, ''))) || gitGrepPager(segment);
}

// Command or process substitution runs a command inside any verb (HOLD 6079468845).
const SUBSTITUTION = /\$\(|`|[<>]\(/;

function isReadOnly(segment: string): boolean {
  if (SUBSTITUTION.test(segment)) return false;
  if (READ_SED.test(segment)) return true;
  return READ_VERB.test(segment) && !runsCommand(segment);
}


/**
 * Text as the file system reads it (HOLD 6082847596 M3): APFS folds case, and
 * // , /./ and dir/.. all resolve, so .Claude/Projects, .claude//projects and
 * .claude/x/../projects open the transcripts dir.
 */
function pathFold(text: string): string {
  let t = text.toLowerCase().replace(/\/(?:\.\/)+/g, '/').replace(/\/{2,}/g, '/');
  for (let prev = ''; prev !== t; ) {
    prev = t;
    t = t.replace(/\/[^/\s]+\/\.\.(?=\/)/, '');
  }
  return t;
}
const REPO_FLAG = /(?:^|\s)(?:-R|--repo)(?:\s|=|$)/;
// A guard call is one plain command: letters, digits, - _ . / : and spaces.
// Quotes, escapes, globs, braces, ~, =, $, backticks and chaining would let the
// shell hand the script a flag this text never spells (--post-ver''dict,
// --post-verd*) or set a variable (TMPDIR, GH_REPO).
const PLAIN_CALL = /^[A-Za-z0-9_\-./: ]+$/;
// The one MCP server review-pr uses; every other MCP tool may hold its own
// GitHub token (a GitHub MCP server), so it is denied while the skill runs.
const MCP_ALLOWED = /^mcp__memory__/;

/** gh read verbs, by subcommand. Anything else is a write or unknown: denied. */
const GH_READ: Record<string, readonly string[]> = {
  pr: ['view', 'diff', 'checks', 'list', 'status'],
  issue: ['view', 'list', 'status'],
  repo: ['view'],
  run: ['view', 'list', 'watch'],
  auth: ['status'],
  release: ['view', 'list'],
  workflow: ['view', 'list'],
  label: ['list'],
};
const GH_READ_ANY_VERB = new Set(['search', 'help', '--version', 'version']);

// Any field or input flag, also glued to its value (-fbody=x, -Fq=@f, --input=f).
const GITHUB_HOST = /\b(?:api\.github\.com|uploads\.github\.com|github\.com)\b/i;
// The host as a directory under one slash (~/go/src/github.com/o/r) is a path,
// not a URL: a URL has // before it, a bare host has nothing.
const GITHUB_HOST_NOT_PATH = /(?<![^/\s]\/)\b(?:api\.github\.com|uploads\.github\.com|github\.com)\b/i;

// The GraphQL endpoint as gh api takes it: graphql, /graphql, or a URL to it.
const GRAPHQL_ENDPOINT = /^(?:https?:\/\/[^/\s]+(?:\/api)?)?\/?graphql\/?(?:[?#].*)?$/i;

/**
 * Why `gh api` with these args writes, or null. Reads token by token, so a
 * short-flag cluster counts too (-iX POST, -iXPATCH, -fbody=x). Field flags
 * are query fields on an explicit GET (gh api -X GET search/issues -f q=x).
 */
function ghApiWrite(rest: string): string | null {
  const toks = rest.split(/\s+/).filter(Boolean);
  const unq = (t: string) => t.replace(/^['"]|['"]$/g, '');
  if (toks.some((t) => GRAPHQL_ENDPOINT.test(unq(t)))) return 'gh api graphql';
  const methods: string[] = [];
  let fields = false;
  for (let i = 0; i < toks.length; i += 1) {
    const t = unq(toks[i]);
    if (/^--input(?:=|$)/.test(t)) return 'gh api with an input flag';
    if (/^--(?:field|raw-field)(?:=|$)/.test(t)) fields = true;
    const long = t.match(/^--method(?:=(.*))?$/);
    if (long) {
      methods.push(unq(long[1] ?? toks[i + 1] ?? ''));
      continue;
    }
    if (/^-[A-Za-z]+/.test(t) && !t.startsWith('--')) {
      const cluster = t.slice(1);
      if (/[fF]/.test(cluster.split('X')[0])) fields = true;
      const x = cluster.indexOf('X');
      if (x >= 0) methods.push(unq(cluster.slice(x + 1) || toks[i + 1] || ''));
    }
  }
  const other = methods.find((v) => v.toUpperCase() !== 'GET');
  if (other !== undefined) return `gh api --method ${other || '?'}`;
  if (fields && methods.length === 0) return 'gh api with a field flag';
  return null;
}

/** Split a command line into shell segments on ; & | && || and newlines. */
function segments(command: string): string[] {
  // An & inside a descriptor redirect (0<&0, 2>&1, &>f) is not a separator.
  return command.split(/\n|;|&&|\|\||\||(?<![<>&])&(?![>&])/).map((s) => s.trim()).filter(Boolean);
}

/** Why a gh invocation in this segment is a write, or null when it is a read. */
function ghWrite(segment: string): string | null {
  // gh after a space, a paren, a quote (bash -c "gh ...") or a path (/usr/bin/gh).
  const m = segment.match(/(?:^|[\s("'=/])gh((?:\s+(?:-R|--repo)(?:\s+|=)\S+)*)\s+([^\s'"]+)(?:\s+([^\s'"]+))?([\s\S]*)$/);
  if (!m) return null;
  const sub = m[2];
  const verb = m[3] ?? '';
  const rest = `${verb} ${m[4] ?? ''}`;
  if (GH_READ_ANY_VERB.has(sub)) return null;
  if (sub === 'api') return ghApiWrite(rest);
  if (sub === 'auth' && verb === 'status' && /(?:^|\s)(?:-t|--show-token)(?:\s|$)/.test(rest)) return 'gh auth status with a token print';
  const reads = GH_READ[sub];
  if (reads?.includes(verb)) return null;
  return `gh ${sub}${verb ? ` ${verb}` : ''}`;
}

// A gh write verb after any command word: the shell can build the name
// ($G, \gh, "g"h, g''h, ${GH:-gh}), so the verb is matched without gh spelled.
const WRITE_VERB =
  /(?:^|[\s"'`)}\\])(?:pr|issue)\s+(?:review|comment|close|merge|edit|reopen|ready|create|lock|unlock|delete|checkout|revert|transfer|pin|unpin|develop)\b|(?:^|[\s"'`)}\\])(?:release|label|repo|secret|variable|workflow|gist|ruleset)\s+(?:create|edit|delete|upload|set|rename|archive|fork|sync|run|enable|disable)\b/;
const API_WORD = /(?:^|[\s"'`)}\\])api\s+([\s\S]*)$/;

/** Why this segment runs a gh write by a name the text never spells, or null. */
function verbWrite(raw: string): string | null {
  // The shell removes quotes and backslashes before it runs a word, so
  // p''r rev''iew and "pr" "comment" run as pr review and pr comment.
  // An interpreter takes the words as a list (['gh','pr','comment'],
  // system("gh","issue","comment")), so a comma or bracket separates words too.
  const segment = raw.replace(/['"\\]/g, '').replace(/[,[\]]/g, ' ');
  const m = segment.match(WRITE_VERB);
  if (m) return `a gh write verb (${m[0].trim()})`;
  const api = segment.match(API_WORD);
  if (api) return ghApiWrite(api[1]);
  return null;
}

/**
 * Any curl, wget or httpie/xh call to a GitHub host, read or write: review-pr
 * reads GitHub through gh, so no HTTP client form needs telling apart (curl
 * -sSd @f, -sXPOST, `http POST`, `xh post`, `https host key=value`).
 */
function httpWrite(segment: string): string | null {
  if (!/(?:^|[\s("'=/])(?:curl|wget|http|https|httpie|xh|xhs)\s/.test(segment)) return null;
  return GITHUB_HOST.test(segment) ? 'an HTTP client call to GitHub' : null;
}

// A non-shell interpreter, by name or path (/usr/bin/python3, python3.12).
const INTERPRETER =
  /(?:^|[\s;&|(`/])(?:python[0-9.]*|pypy[0-9.]*|ipython[0-9.]*|node|nodejs|tsx|ts-node|deno|bun|perl|ruby|irb|php|lua|luajit|Rscript|osascript|awk|gawk|mawk|nawk|tclsh|jshell|swift)(?=[\s;&|)<]|$)/;

/**
 * Why a command that runs an interpreter writes to GitHub, or null. One rule
 * for the class: the list can be built any way (+, concat, nested parens, a
 * heredoc one item per line), so the whole command is read with newlines and
 * every non-word character folded to spaces.
 */
function interpreterWrite(command: string): string | null {
  if (!INTERPRETER.test(command)) return null;
  if (GITHUB_HOST.test(command)) return 'an interpreter call that names a GitHub host';
  const folded = ` ${command.replace(/[^A-Za-z0-9_]+/g, ' ')} `;
  if (/\sgh\s/.test(folded)) return 'an interpreter call that names gh';
  const m = folded.match(WRITE_VERB);
  return m ? `an interpreter call with a gh write verb (${m[0].trim()})` : null;
}

/**
 * Why a segment that is not a known read names GitHub or gh, or null. Every
 * non-word character (quotes, commas, brackets, +, dots) is folded to a space,
 * so ['gh','pr'].concat(...) and 'g' + 'h' read as words.
 */
function foldedWrite(segment: string): string | null {
  if (GITHUB_HOST_NOT_PATH.test(segment)) return 'a command that names a GitHub host';
  // gh glued to - or . and a word is a file name (/tmp/gh-review, gh.json), not gh.
  const folded = ` ${segment.replace(/\bgh(?=[-.][A-Za-z0-9])/g, 'gh_').replace(/[^A-Za-z0-9_]+/g, ' ')} `;
  if (/\sgh\s/.test(folded)) return 'a command that names gh';
  const m = folded.match(WRITE_VERB);
  return m ? `a command with a gh write verb (${m[0].trim()})` : null;
}

/** A direct gh call (optionally by path or after VAR=x) that ghWrite reads as a read. */
function isGhRead(segment: string): boolean {
  return /^(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:\S*\/)?gh(?:\s|$)/.test(segment) && ghWrite(segment) === null;
}

interface Heredocs {
  /** The command with every heredoc body removed. */
  main: string;
  /**
   * Each heredoc whose receiver is not a read, as one segment: the receiver,
   * then the body unsplit (a | or ; in a body is text, not a pipe).
   */
  joined: string[];
  /** The body lines: data, not commands, unless the receiver runs them. */
  body: string[];
}

// One heredoc as bash reads it: << or <<- (not <<<), a whole word delimiter,
// quoted or not, then a space or the end of the line (not END-X).
const HEREDOC = /(?:^|[^<])<<(-?)[ \t]*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\2(?=\s|$)/;

/**
 * Split heredoc bodies out of the command, or null when any << is not a clean
 * match (HOLD 6079468845): one heredoc on the line, in its last segment (no
 * pipe after it), a terminator line bash ends on, and, for an unquoted
 * delimiter, no $( or backtick in the body (bash runs them). On null the
 * caller scans the whole command, every line a segment.
 */
function splitHeredocs(command: string): Heredocs | null {
  const keep: string[] = [];
  const joined: string[] = [];
  const body: string[] = [];
  const lines = command.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    keep.push(lines[i]);
    if (!lines[i].includes('<<')) continue;
    const m = lines[i].match(HEREDOC);
    if (!m || (lines[i].match(/<</g) ?? []).length !== 1) return null;
    // A quote or backslash before the << can make it a word, not a heredoc.
    if (/['"\\]/.test(lines[i].slice(0, lines[i].indexOf('<<')))) return null;
    const receiver = segments(lines[i]).pop();
    if (receiver === undefined || !receiver.includes('<<')) return null;
    const ends = (l: string) => (m[1] ? l.replace(/^\t+/, '') : l) === m[3];
    let j = i + 1;
    const own: string[] = [];
    for (; j < lines.length && !ends(lines[j]); j += 1) own.push(lines[j]);
    if (j >= lines.length) return null;
    if (!m[2] && own.some((l) => /\$\(|`/.test(l))) return null;
    if (!isReadOnly(receiver)) joined.push(`${receiver} ${own.join(' ')}`);
    body.push(...own);
    i = j;
  }
  return { main: keep.join('\n'), joined, body };
}

// Shell, source, eval and xargs calls (HOLD 6079468845, XREVIEW 6080480743 and
// 6080821044). The words are read after quote removal ('sh', \sh, "/bin/sh")
// and after assignments and prefix words (env -u X sh, nice -n 5 sh: the
// first runner word after a prefix is the command, whatever the prefix's
// option arguments are). Only two shell forms are classified: a checked sh -c
// program, or a script file after no-argument flags. Any other shell call
// denies: stdin, /dev/stdin, a process substitution, a redirect, or an option
// the gate cannot classify (-O extglob, +O, -o, --rcfile, --init-file).
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'mksh', 'ash', 'yash', 'fish', 'csh', 'tcsh']);
const RUNNERS = new Set([...SHELLS, 'source', '.', 'eval', 'xargs']);
const PREFIX_WORDS = new Set([
  'env', 'command', 'exec', 'builtin', 'nohup', 'time', 'sudo', 'doas', 'stdbuf', 'nice', 'timeout',
  'setsid', 'chronic', 'ionice', 'caffeinate', 'unbuffer', 'flock', 'su', 'runuser', 'script', 'chroot',
]);
// Runners whose own argument is a command string run by a shell (flock -c,
// su -c, script -c), or always is (watch, parallel): the gate cannot read it.
const STRING_RUNNERS = new Set(['watch', 'parallel']);
const COMMAND_FLAG = /^(?:-[A-Za-z]*c|--command(?:=.*)?)$/;
// Variables that make git or gh run a command (a pager, an editor, ssh).
const RUNS_VAR =
  /^(?:export\s+)?(?:GIT_PAGER|PAGER|GH_PAGER|GIT_EDITOR|GIT_SEQUENCE_EDITOR|EDITOR|VISUAL|GH_EDITOR|GIT_EXTERNAL_DIFF|GIT_SSH_COMMAND|GIT_SSH|GIT_ASKPASS|SSH_ASKPASS|BROWSER|GH_BROWSER)=(.*)$/;
// A file name that is the shell's own stdin or a process substitution.
const STDIN_FILE = /^(?:\/dev\/stdin|\/dev\/fd\/\d+|\/proc\/[^/]+\/fd\/\d+)$/;
/**
 * A script path the gate cannot trust: the shell's stdin in any spelling
 * (/dev/./stdin, //dev/stdin, /proc/thread-self/fd/0), a process
 * substitution, a redirect, or a path built at run time ("$F").
 */
function unseenScriptPath(f: string): boolean {
  if (/^[-<]/.test(f) || /[$`]/.test(f)) return true;
  if (f.startsWith('/')) return STDIN_FILE.test(posix.normalize(f));
  // A relative path resolves against a cwd this text does not fix (cd /dev;
  // sh stdin): refuse any that could be stdin or a descriptor.
  return STDIN_FILE.test(posix.normalize(`/${f}`)) || /(?:^|\/)(?:stdin|\d+)$/.test(f) || /(?:^|\/)(?:dev|proc|fd)(?:\/|$)/.test(f);
}
// No-argument flags; -n is a syntax check that runs nothing (never with -i).
const NO_ARG_FLAG = /^-[elxuvn]+$/;
// A program this gate already checked, replaced by `sh -c :`.
const CHECKED = /^sh -c :(?:\s|$)/;
const baseName = (t: string): string => t.replace(/^.*\//, '');

// Command words that only read: a shell word after them is data (grep -n bash f).
const READ_WORDS = new Set(['cat', 'head', 'tail', 'wc', 'nl', 'ls', 'stat', 'file', 'diff', 'grep', 'egrep', 'fgrep', 'rg', 'test', 'which', 'type']);
const COMPOUND = new Set(['{', '}', '!', '(', ')', 'if', 'then', 'else', 'elif', 'fi', 'while', 'until', 'do', 'done', 'for', 'esac', 'select', 'coproc', 'function']);

/** Words split on unquoted blanks, quotes and escapes kept in each word. */
function shellWords(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';
  for (let k = 0; k < text.length; k += 1) {
    const c = text[k];
    if (quote) {
      cur += c;
      if (c === quote) quote = '';
      else if (quote === '"' && c === '\\' && k + 1 < text.length) cur += text[(k += 1)];
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === '\\' && k + 1 < text.length) {
      cur += c + text[(k += 1)];
    } else if (/\s/.test(c)) {
      if (cur) out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// A redirect word (2>/dev/null, 0<&0, </dev/stdin, &>f, <<EOF); an operator
// alone (2> f) takes the next word as its target.
// <( and >( are process substitutions, not redirects: they stay words.
const REDIRECT = /^(?:\d*|&)(?:<<<|<<-?|>>|<>|<&|>&|&>>?|<|>)(?!\()(.*)$/;

/**
 * The words bash runs for one segment, from its command word on, or null when
 * the gate cannot resolve them (HOLD 6082847596, XREVIEW 6082111346). Quotes
 * are removed and every redirect is dropped, before or after the command word.
 * Assignments are skipped. After a prefix word (env, nice, flock, ...) the
 * command is the first word this classifier reads (a shell, runner, find, git,
 * watch); a run-time word ($SHELL, $(which sh), a backtick) or an option
 * before it is refused, because its argument count is not known here.
 */
export function resolveCommand(part: string): string[] | null {
  // Split on unquoted blanks first, so a quoted redirect target stays one
  // word (2>"x -n"), then drop redirects, then remove the quotes.
  const raw = shellWords(part);
  const toks: string[] = [];
  for (let k = 0; k < raw.length; k += 1) {
    const r = raw[k].match(REDIRECT);
    if (r) {
      if (r[1] === '') k += 1;
      continue;
    }
    toks.push(raw[k].replace(/['"\\]/g, ''));
  }
  let i = 0;
  // Compound-command words and a case pattern or f() come before the command
  // ({ sh; }, then sh, do sh, x) sh, f() { sh; }), as do assignments.
  for (;;) {
    if (i < toks.length && (COMPOUND.has(toks[i]) || /\)$/.test(toks[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i]))) {
      i += 1;
    } else if (toks[i] === 'case') {
      // case WORD in PATTERN) cmd: the command follows the pattern.
      const pat = toks.findIndex((t, k) => k > i && /\)$/.test(t));
      i = pat < 0 ? toks.length : pat + 1;
    } else {
      break;
    }
  }
  if (i < toks.length && PREFIX_WORDS.has(baseName(toks[i]))) {
    const rest = toks.slice(i + 1);
    const stop = (t: string) => RUNNERS.has(t) || STRING_RUNNERS.has(t) || t === 'find' || t === 'git';
    const j = rest.findIndex((t) => stop(baseName(t)));
    if (j < 0) return toks.slice(i);
    if (rest.slice(0, j).some((t) => /[$`]/.test(t) || /^[-+]/.test(t))) return null;
    return rest.slice(j);
  }
  return toks.slice(i);
}

// The only awk program that passes: a pure field print ({print}, {print $1, $NF}).
const AWK_FIELD_PRINT = /^\{\s*print(?:\s+\$(?:\d+|NF)(?:\s*,?\s*\$(?:\d+|NF))*)?\s*;?\s*\}$/;

/**
 * Why this resolved command runs an inline interpreter program, or null
 * (XREVIEW HOLD 6084895142). A primitive list cannot win against a computed
 * name (getattr(__import__('o'+'s'),'sy'+'stem')), so every inline program
 * denies whatever it holds: -c, -e, -p, -r, eval, a program on stdin, osascript,
 * and any awk program but a pure field print. A script file passes.
 */
function inlineProgram(w: string[]): string | null {
  const name = baseName(w[0] ?? '');
  const args = w.slice(1);
  const operand = args.find((a) => !a.startsWith('-'));
  const has = (re: RegExp) => args.some((a) => re.test(a));
  const why = `an inline ${name} program`;
  if (/^(?:python|pypy|ipython)[0-9.]*$/.test(name)) {
    if (has(/^-[A-Za-z]*c/) || args.includes('-')) return why;
    if (operand === undefined && !has(/^-[A-Za-z]*m/)) return why;
    return null;
  }
  if (/^(?:node|nodejs|bun|tsx|ts-node)$/.test(name)) {
    return has(/^(?:-[A-Za-z]*[ep][A-Za-z]*|--eval|--print)(?:=|$)/) || operand === undefined ? why : null;
  }
  if (name === 'deno') return operand === undefined || operand === 'eval' || operand === 'repl' ? why : null;
  if (/^(?:perl|ruby|php|lua|luajit|Rscript)$/.test(name)) {
    return has(/^-[A-Za-z]*[eEr]/) || operand === undefined ? why : null;
  }
  if (/^(?:osascript|irb|tclsh|jshell|swift)$/.test(name)) return why;
  if (/^[gmn]?awk$/.test(name)) {
    let k = 0;
    while (k < args.length && args[k].startsWith('-')) {
      if (/^-f/.test(args[k])) return why;
      k += /^-[Fv]$/.test(args[k]) ? 2 : 1;
    }
    return AWK_FIELD_PRINT.test(args[k] ?? '') ? null : why;
  }
  return null;
}

/** A word that runs a command or a script: a shell, interpreter, runner or prefix. */
function isRunnerWord(t: string): boolean {
  const b = baseName(t);
  return SHELLS.has(b) || RUNNERS.has(b) || PREFIX_WORDS.has(b) || STRING_RUNNERS.has(b) || b === 'git' || INTERPRETER.test(` ${b} `);
}

function runsUnseenScript(part: string): string | null {
  const resolved = resolveCommand(part);
  if (resolved === null) return 'a command word the gate cannot resolve';
  const w = resolved;
  // A program word built at run time ($SHELL, ${S:-sh}, `x`), also behind a
  // prefix (env $SHELL): the gate cannot resolve it (product-6 HOLD 6081164375).
  const runtime = (t: string) => /[$`]/.test(t);
  if (runtime(w[0] ?? '') || (PREFIX_WORDS.has(baseName(w[0] ?? '')) && w.slice(1).some(runtime))) {
    return 'a program word built at run time';
  }
  // A pager, editor or ssh variable set to a command (GIT_PAGER=sh git log).
  const all = part.replace(/['"\\]/g, '').split(/\s+/);
  for (let t = 0; t < all.length; t += 1) {
    const v = (all[t] === 'export' ? '' : all[t]).match(RUNS_VAR);
    if (v && !['', 'cat', 'less', 'more'].includes(v[1])) return 'a pager, editor or ssh variable set to a command';
  }
  const cmd = baseName(w[0] ?? '');
  const inline = inlineProgram(w);
  if (inline) return inline;
  // A shell or runner word after a command word that is not a known read or
  // a word this classifier reads (arch -arm64 sh, busybox sh): the gate does
  // not know that wrapper, so it cannot prove the shell does not run.
  if (!RUNNERS.has(cmd) && !READ_WORDS.has(cmd) && !['find', 'git'].includes(cmd) && w.slice(1).some((t) => t !== '.' && RUNNERS.has(baseName(t)))) {
    return 'a shell word after a command the gate cannot resolve';
  }
  // git -c and --config-env set alias, pager or hook commands (git -c alias.x=!sh x).
  if (cmd === 'git' && w.some((t) => t === '-c' || /^--config-env(?:=|$)/.test(t))) return 'git -c or --config-env';
  if (STRING_RUNNERS.has(cmd)) return `${cmd} runs a command string`;
  if (PREFIX_WORDS.has(cmd) && w.some((t) => COMMAND_FLAG.test(t)) && ['flock', 'su', 'runuser', 'script'].includes(cmd)) {
    return `${cmd} -c runs a command string`;
  }
  // find runs the words after -exec, -execdir, -ok and -okdir, with this
  // command's stdin (printf ... | find . -exec sh \;).
  if (cmd === 'find' && w.some((t, i) => /^-(?:exec|execdir|ok|okdir)$/.test(t) && isRunnerWord(w[i + 1] ?? ''))) {
    return 'find -exec into a shell, an interpreter or a runner';
  }
  if (!RUNNERS.has(cmd)) return null;
  if (cmd === 'eval') return 'eval';
  if (cmd === 'xargs') {
    // xargs runs the next word as a command with words from stdin: into a
    // shell, an interpreter or another runner it runs stdin (xargs env sh).
    // A word built at run time ($G, "$G", a backtick) can be any runner too.
    return w.slice(1).some((t) => isRunnerWord(t) || /[$`]/.test(t)) ? 'xargs into a shell, an interpreter, a runner or a run-time word' : null;
  }
  if (cmd === 'source' || cmd === '.') {
    const f = w[1];
    return f === undefined || unseenScriptPath(f) ? 'source of stdin or a run-time path' : null;
  }
  if (CHECKED.test(w.join(' '))) return null;
  let k = 1;
  while (k < w.length && NO_ARG_FLAG.test(w[k])) k += 1;
  const op = w[k];
  if (op !== undefined && /^[-+]/.test(op)) return 'a shell call the gate cannot classify';
  if (w.slice(1, k).some((f) => f.includes('n'))) return null;
  if (op === undefined || unseenScriptPath(op)) return 'a shell that reads its script from stdin or a run-time path';
  return null;
}

// A shell word, then only no-argument flags, one holding c: the next word is
// the program. Any other option before the program is not parsed here, so the
// call is left for runsUnseenScript, which denies it.
const SHELL_C_AT = /(^|[\s;&|(`])((?:\S*\/)?(?:ba|z|da|k|mk)?sh)((?:\s+-[elxuvc]+)+)\s+/g;

/**
 * Every sh -c program, parsed before the command is split (a ; or | inside
 * the quotes is the program's, not this command's). A program is checked as
 * a command of its own; one the gate cannot read (a $, backtick or backslash
 * in double quotes, an unquoted word that is not plain) denies. On null the
 * returned text has each checked program replaced by `sh -c :`.
 */
function checkShellPrograms(command: string): { why: string | null; rest: string; flat: string } {
  const unreadable = { why: 'an sh -c program the gate cannot read', rest: command, flat: command };
  let out = '';
  // The same text with each program inlined as its own command line, so the
  // path rule follows a cd inside it ( ; <program> ; ).
  let flat = '';
  let last = 0;
  for (const m of command.matchAll(SHELL_C_AT)) {
    const at = m.index ?? 0;
    if (at < last || !m[3].includes('c')) continue;
    const start = at + m[1].length;
    const i = at + m[0].length;
    const q = command[i];
    let program: string;
    let end: number;
    if (q === "'" || q === '"') {
      end = command.indexOf(q, i + 1);
      if (end < 0) return unreadable;
      program = command.slice(i + 1, end);
      if (q === '"' && /[$`\\]/.test(program)) return unreadable;
      end += 1;
    } else {
      const w = command.slice(i).match(/^[A-Za-z0-9_\-./:]+(?=[\s;&|)]|$)/);
      if (!w || w[0].startsWith('-')) return unreadable;
      program = w[0];
      end = i + w[0].length;
    }
    if (GUARD_SCRIPT.test(program)) return { why: 'post-review.mjs inside sh -c', rest: command, flat: command };
    // The words after the program are its arguments: a positional parameter
    // in the program runs them ($@, $*, $1), which this check cannot read.
    const trailing = (command.slice(end).match(/^[^;&|\n]*/)?.[0] ?? '').trim();
    if (trailing && /\$(?:[@*#]|\d|\{[@*#\d])/.test(program)) {
      return { why: 'a positional parameter in an sh -c program with trailing words', rest: command, flat: command };
    }
    // The program is a nested command line, checked by the same rules.
    const why = rawWriteReason(program);
    if (why) return { why, rest: command, flat: command };
    out += `${command.slice(last, start)}sh -c :`;
    flat += `${command.slice(last, start)} ; ${checkShellPrograms(program).flat} ; `;
    last = end;
  }
  return { why: null, rest: out + command.slice(last), flat: flat + command.slice(last) };
}

/**
 * Why the command writes to GitHub by any path but the guard script, or null.
 * No quoted text is skipped: `echo "$(gh pr comment ...)"` runs the post, so a
 * harmless `echo "gh pr review"` is denied too (fail closed).
 */
export function rawWriteReason(input: string): string | null {
  // bash removes backslash-newline before it splits words (s\<newline>h is sh).
  const full = input.replace(/\\\n/g, '');
  // The guard call is node + a file and one plain command, so it holds no
  // inline code; its --pr URL names github.com on purpose.
  const plainGuard = GUARD_CALL.test(full.trim()) && PLAIN_CALL.test(full.trim());
  const programs = plainGuard ? { why: null, rest: full } : checkShellPrograms(full);
  if (programs.why) return programs.why;
  const command = programs.rest;
  const interp = plainGuard ? null : interpreterWrite(command);
  if (interp) return interp;
  // Not a clean heredoc: scan the whole command, every line a segment.
  const docs = splitHeredocs(command) ?? { main: command, joined: [], body: [] };
  // A body line is data (a review body with a github.com link is fine), but a
  // line that spells a gh write keeps the old checks: it may be run later.
  for (const line of docs.body) {
    if (isReadOnly(line.trim())) continue;
    const why = ghWrite(line.trim()) ?? verbWrite(line.trim()) ?? httpWrite(line.trim());
    if (why) return why;
  }
  // A heredoc into any receiver that is not a pure read is code (tsx <<TS):
  // the receiver and body are read whole, never split on ; or newlines, so
  // no fragment of the body gets a read exemption (XREVIEW HOLD 6080480743).
  for (const code of docs.joined) {
    const why = ghWrite(code) ?? verbWrite(code) ?? httpWrite(code) ?? foldedWrite(code);
    if (why) return why;
  }
  for (const seg of segments(docs.main)) {
    // Command substitution and subshells: scan their insides as segments too.
    const inner = [seg, ...[...seg.matchAll(/\$\(([^()]*)\)|`([^`]*)`|\(([^()]*)\)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')];
    for (const s of inner) {
      for (const part of segments(s)) {
        // A read verb with a flag that runs a command is not a read.
        // The shell removes quotes first, so "--pre" and '-O...' are the flags.
        if (runsCommand(part)) return 'a read verb with a flag that runs a command';
        const unseen = runsUnseenScript(part);
        if (unseen) return unseen;
        // A search or a history read names write verbs without running them.
        if (isReadOnly(part)) continue;
        // A checked sh -c program (replaced by `sh -c :` above).
        if (CHECKED.test((resolveCommand(part) ?? []).join(' '))) {
          // The checked program is gone; its trailing words are still checked.
          const after = part.replace(/^[\s\S]*?sh -c :/, '').trim();
          const trail = after && (ghWrite(` ${after}`) ?? verbWrite(after) ?? httpWrite(after) ?? foldedWrite(after));
          if (trail) return trail;
          continue;
        }
        const why = ghWrite(part) ?? verbWrite(part) ?? httpWrite(part);
        if (why) return why;
        if (plainGuard || isGhRead(part)) continue;
        const folded = foldedWrite(part);
        if (folded) return folded;
      }
    }
  }
  return null;
}

/** Kept for callers and tests that ask yes or no. */
export function isRawPost(command: string): boolean {
  return rawWriteReason(command) !== null;
}

export interface OptIn {
  post: boolean;
  postVerdict: boolean;
  prs: string[];
}

// The forms post-review.mjs takes for --pr, which it hands to gh unchanged.
const PR_URL = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/;
const PR_NUM = /^\d+$/;

/**
 * The PR the user typed: the first argument after the command that is not a
 * flag, as a number (4668 or #4668 gives 4668) or a full github.com pull URL.
 * Any later number is not a target. The call must pass it exactly: a number
 * and a URL with the same number are different targets (the URL can name
 * another repo), so they never match each other.
 */
function prTokens(tokens: readonly string[]): string[] {
  const first = tokens.find((t) => !t.startsWith('-'));
  if (first === undefined) return [];
  const v = first.replace(/\/$/, '');
  if (PR_URL.test(v)) return [v];
  if (/^#?\d+$/.test(v)) return [v.replace(/^#/, '')];
  return [];
}

/** Same directory, ignoring trailing slashes. No filesystem reads (FH-ready). */
function sameDir(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const n = (p: string) => p.replace(/\/+$/, '') || '/';
  return n(a) === n(b);
}

/** What the user typed on the /ork:review-pr line on this call's chain. Absent = nothing. */
export function readOptIn(transcriptPath: string | undefined, toolUseId: string | undefined): OptIn {
  const args = chainUserCommandArgs(transcriptPath, SKILL_NAMES, toolUseId) ?? [];
  return { post: args.includes('--post'), postVerdict: args.includes('--post-verdict'), prs: prTokens(args) };
}

export interface ReviewPostGateDeps {
  readOptIn: (transcriptPath: string | undefined, toolUseId: string | undefined) => OptIn;
  /** CLAUDE_PLUGIN_ROOT exactly, '' when unset: no fallback to the project dir. */
  pluginRoot: () => string;
  /** HOME, for ~ and the default config dir ~/.claude. */
  home?: () => string;
  /** CDPATH from the environment: set, a relative cd target is not resolvable. */
  cdpath?: () => string;
}

const DEFAULT_DEPS: ReviewPostGateDeps = {
  readOptIn,
  pluginRoot: () => (process.env.CLAUDE_PLUGIN_ROOT ?? '').trim().replace(/\/+$/, ''),
  home: () => process.env.HOME ?? '',
  cdpath: () => process.env.CDPATH ?? '',
};

const SCRIPT_REL = 'skills/review-pr/scripts/post-review.mjs';

/**
 * ANSI-C ($'...') and locale ($"...") quoting decoded to plain quoted text, so a
 * path test reads what bash opens ($'\x70rojects' is projects, HOLD 6084834846 M2).
 */
function decodeAnsiC(text: string): string {
  const esc: Record<string, string> = { n: '\n', t: '\t', r: '\r', e: '\x1b', a: '\x07', b: '\b', f: '\f', v: '\v' };
  return text
    .replace(/\$'((?:[^'\\]|\\.)*)'/g, (_m, body: string) =>
      `'${body.replace(/\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|U[0-9a-fA-F]{1,8}|[0-7]{1,3}|.)/g, (_e, c: string) => {
        if (/^[xuU]/.test(c)) return String.fromCodePoint(parseInt(c.slice(1), 16));
        if (/^[0-7]/.test(c)) return String.fromCharCode(parseInt(c, 8));
        return esc[c] ?? c;
      })}'`,
    )
    .replace(/\$"/g, '"');
}

/**
 * ONE path rule (HOLD 6085261794): the command is split on shell separators,
 * the cwd starts at input.cwd and follows cd and pushd, ANSI-C quoting is
 * decoded, and every word is resolved to an absolute, normalized (. and ..),
 * case-folded (APFS) path. Only the protected targets count, so a project's
 * own .claude passes.
 */
interface PathTargets {
  /** The Claude config dir of transcript_path (it holds projects/), and ~/.claude. */
  configDirs: string[];
  /** The code the gate trusts: <plugin root>/hooks and <plugin root>/skills/review-pr. */
  codeDirs: string[];
}

const HOME_ALIAS = /^(?:~|\$home|\$\{home\})(?=\/|$)/;

/** One word as an absolute, folded, normalized path, or null when it cannot be one. */
function resolvePath(word: string, cwd: string, home: string): string | null {
  // A redirect target (>x, 2>>x), a flag value (--file=x) or an assignment
  // value (P=~/x, where bash expands the tilde) is a path too.
  let w = word.replace(/^\d*[<>&]+/, '');
  if (/^[^/]*=/.test(w)) w = w.slice(w.indexOf('=') + 1);
  if (!w || w.startsWith('-')) return null;
  w = w.toLowerCase();
  if (HOME_ALIAS.test(w)) {
    if (!home) return null;
    w = home + w.replace(HOME_ALIAS, '');
  }
  const abs = w.startsWith('/') ? w : cwd ? `${cwd}/${w}` : null;
  return abs === null ? null : posix.normalize(abs).replace(/(.)\/+$/, '$1');
}

/** Every path word of a command, each resolved against the cwd it runs in. */
export function commandPaths(command: string, startCwd: string, home: string): string[] {
  return pathSegments(command, startCwd, home).flatMap((x) => x.paths);
}

const UNRESOLVED_CD = '\u0000unresolved-cd';

/** Each segment with its resolved path words. */
function pathSegments(command: string, startCwd: string, home: string, envCdpath = false): Array<{ seg: string; paths: string[] }> {
  // With CDPATH set, bash looks a relative cd target up in it (CDPATH=~ cd
  // .claude lands in ~/.claude), so such a target cannot be resolved here.
  const cdpath = envCdpath || /(?:^|[\s;&|(])(?:export\s+)?CDPATH=/.test(command);
  const out: Array<{ seg: string; paths: string[] }> = [];
  const h = home.toLowerCase().replace(/\/+$/, '');
  let cwd = startCwd ? posix.normalize(startCwd.toLowerCase()) : '';
  for (const seg of segments(decodeAnsiC(command))) {
    // Quoted parts neutralize globs (bash does not expand them), then quotes
    // and escapes are removed.
    const words = shellWords(seg).map((t) =>
      t.replace(/'[^']*'|"[^"]*"/g, (q) => q.slice(1, -1).replace(/[*?[{]/g, '_')).replace(/\\(.)/g, '$1'),
    );
    const paths: string[] = [];
    for (const w of words) {
      const p = resolvePath(w, cwd, h);
      if (p !== null) paths.push(p);
    }
    out.push({ seg, paths });
    const at = words.findIndex((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
    if (at >= 0 && (words[at] === 'cd' || words[at] === 'pushd')) {
      const target = words.slice(at + 1).find((w) => !/^-./.test(w));
      // A target the gate cannot resolve (cd -, $D, a backtick, ~user) would
      // leave every later relative path unseen: the segment is marked unresolved.
      const viaCdpath = cdpath && target !== undefined && !/^(?:\/|~|\.{1,2}(?:\/|$))/.test(target);
      if (target !== undefined && (target === '-' || /[$`]/.test(target) || /^~[^/]/.test(target) || viaCdpath)) {
        out.push({ seg: UNRESOLVED_CD, paths: [] });
        cwd = '';
      } else {
        cwd = target === undefined ? h : (resolvePath(target, cwd, h) ?? '');
      }
    }
  }
  return out;
}

function pathTargets(input: HookInput, deps: ReviewPostGateDeps): PathTargets {
  const home = (deps.home?.() ?? '').toLowerCase().replace(/\/+$/, '');
  const config = new Set<string>();
  if (home) config.add(`${home}/.claude`);
  const tp = typeof input.transcript_path === 'string' ? posix.normalize(input.transcript_path.toLowerCase()) : '';
  const cut = tp.lastIndexOf('/projects/');
  if (cut > 0) config.add(tp.slice(0, cut));
  const root = deps.pluginRoot() ? posix.normalize(deps.pluginRoot().toLowerCase()).replace(/\/+$/, '') : '';
  return { configDirs: [...config], codeDirs: root ? [`${root}/hooks`, `${root}/skills/review-pr`] : [] };
}

/** Which target a path reaches: 'config', 'code', or null. */
function targetOf(p: string, t: PathTargets): 'config' | 'code' | null {
  for (const dir of t.configDirs) {
    if (p === dir || p.startsWith(`${dir}/`)) return 'config';
    // A glob in a hidden child of the dir's parent can expand to it (~/.cl*, ~/.{claude,x}).
    const parent = posix.dirname(dir);
    const child = p.startsWith(`${parent}/.`) ? p.slice(parent.length + 1).split('/')[0] : '';
    if (/[*?[{]/.test(child)) return 'config';
  }
  for (const dir of t.codeDirs) if (p === dir || p.startsWith(`${dir}/`)) return 'code';
  // Any hook bundle or runner dir, wherever the plugin is installed.
  if (/\/hooks\/(?:dist|bin)(?:\/|$)/.test(p)) return 'code';
  return null;
}

const TRANSCRIPT_DENY =
  'review-pr may not touch a session transcript (.claude/projects): the --post opt-in is read from it. Do not retry another way.';

function deny(ctx: HookContext, input: HookInput, reason: string): HookResult {
  // Build the result first: a log that throws must not turn a deny into an
  // error the runner reports as success (HOLD 6084834846 M1).
  const result = outputDeny(reason);
  try {
    ctx.logPermission('deny', reason, input);
  } catch {
    // The deny stands; the log is best effort.
  }
  return result;
}

/** The --pr value of the guard call, exactly as the script will see it, or null. */
function callPr(command: string): string | null {
  // Exactly one --pr: the script takes the last one, so two could differ.
  const all = [...command.matchAll(/--pr(?:\s+|=)['"]?([^\s'"]+)/g)];
  if (all.length !== 1) return null;
  const v = all[0][1];
  return PR_NUM.test(v) || PR_URL.test(v) ? v : null;
}

export function reviewPostGate(
  input: HookInput,
  ctx: HookContext = NOOP_CTX,
  deps: ReviewPostGateDeps = DEFAULT_DEPS,
): HookResult {
  // run-hook.mjs turns a throw into silent success, so an error here denies.
  try {
    return gate(input, ctx, deps);
  } catch (err) {
    return outputDeny(`review-post-gate failed (${err instanceof Error ? err.message : String(err)}), so it denies. Print the review and stop.`);
  }
}

function gate(input: HookInput, ctx: HookContext, deps: ReviewPostGateDeps): HookResult {
  if (input.tool_name === 'Write' || input.tool_name === 'Edit' || input.tool_name === 'NotebookEdit') {
    // NotebookEdit names its file notebook_path, not file_path.
    const fp = input.tool_input?.file_path ?? (input.tool_input as { notebook_path?: unknown } | undefined)?.notebook_path;
    const targets = pathTargets(input, deps);
    const p = typeof fp === 'string' ? resolvePath(fp, (input.cwd ?? '').toLowerCase(), (deps.home?.() ?? '').toLowerCase()) : null;
    const hit = p === null ? null : targetOf(p, targets);
    const isTranscript = typeof fp === 'string' && typeof input.transcript_path === 'string' && pathFold(fp) === pathFold(input.transcript_path);
    if (hit === 'config' || isTranscript) return deny(ctx, input, TRANSCRIPT_DENY);
    if (hit === 'code' || (typeof fp === 'string' && /(?:^|\/)post-review\.mjs$/i.test(fp))) {
      return deny(ctx, input, 'review-pr may not write the hook code, post-review.mjs or its own skill dir: the post gate runs from them.');
    }
    return outputSilentSuccess();
  }
  if (typeof input.tool_name === 'string' && input.tool_name.startsWith('mcp__')) {
    if (MCP_ALLOWED.test(input.tool_name)) return outputSilentSuccess();
    return deny(
      ctx,
      input,
      `review-pr may not call ${input.tool_name}: an MCP server can hold its own GitHub token. Only the memory server runs while the skill runs.`,
    );
  }
  // Monitor runs a shell command too.
  if (input.tool_name !== 'Bash' && input.tool_name !== 'Monitor') return outputSilentSuccess();
  // bash removes backslash-newline first, so every check reads the joined text
  // (.claude/pro\<newline>jects is .claude/projects).
  const command = typeof input.tool_input?.command === 'string' ? input.tool_input.command.replace(/\\\n/g, '') : '';
  // A Bash or Monitor call with no command string is not a call the gate can read.
  if (!command) return deny(ctx, input, 'review-pr: a Bash or Monitor call with no command is denied (the gate cannot read it).');
  if (typeof input.transcript_path === 'string' && pathFold(command).includes(pathFold(input.transcript_path))) {
    return deny(ctx, input, TRANSCRIPT_DENY);
  }
  const targets = pathTargets(input, deps);
  const plainGuardCall = GUARD_CALL.test(command.trim()) && PLAIN_CALL.test(command.trim());
  // Two views of the command: each sh -c program blanked (the cwd outside it)
  // and inlined (a cd inside it); a hit in either counts.
  const views = checkShellPrograms(command);
  const pathViews = [...new Set([views.rest, views.flat, command])];
  const envCdpath = Boolean((deps.cdpath?.() ?? '').trim());
  for (const { seg, paths } of pathViews.flatMap((v) => pathSegments(v, input.cwd ?? '', deps.home?.() ?? '', envCdpath))) {
    if (seg === UNRESOLVED_CD) return deny(ctx, input, 'review-pr: a cd or pushd target the gate cannot resolve (cd -, a variable, a command) is denied, because the paths after it would be unseen.');
    const hits = paths.map((p) => targetOf(p, targets));
    if (hits.includes('config')) return deny(ctx, input, TRANSCRIPT_DENY);
    // The gate's code (hooks, skills/review-pr) may be read or run as a script
    // (node <file>, python <file>, the plain guard call), never written,
    // copied over or removed.
    if (!hits.includes('code') || plainGuardCall) continue;
    const quiet = seg.replace(/\s2>(?:\/dev\/null|&1)(?=\s|$)/g, ' ');
    const w = resolveCommand(quiet) ?? [];
    const runsScript = /^(?:node|python[0-9.]*)$/.test(baseName(w[0] ?? '')) && inlineProgram(w) === null;
    if (/[<>]/.test(quiet) || !(isReadOnly(quiet.trim()) || runsScript)) {
      return deny(ctx, input, 'review-pr may only read the gate code (hooks, skills/review-pr): the post gate runs from it.');
    }
  }
  const why = rawWriteReason(command);
  if (why) {
    return deny(
      ctx,
      input,
      `review-pr runs gh read-only (${why} is a write). Posts go through scripts/post-review.mjs, and only when the user typed --post. Do not retry another way: print the review and stop.`,
    );
  }
  if (!GUARD_SCRIPT.test(command)) return outputSilentSuccess();
  if (!GUARD_CALL.test(command.trim())) {
    // Named but not run as `node <path>/post-review.mjs`: only a pure read is
    // fine, every segment a read and no redirect, so the file cannot reach node
    // on stdin (cat <script> | node -) or be copied (HOLD 6079468845, Codex P1).
    const quiet = command.replace(/\s2>(?:\/dev\/null|&1)(?=\s|$)/g, ' ');
    if (!/[<>]/.test(quiet) && segments(quiet).every(isReadOnly)) return outputSilentSuccess();
    return deny(ctx, input, 'Run post-review.mjs only as `node <path>/post-review.mjs ...`, one plain command, so this gate reads what runs.');
  }

  if (!PLAIN_CALL.test(command.trim())) {
    return deny(
      ctx,
      input,
      'Call post-review.mjs as one plain command: letters, digits, - _ . / : and spaces only (no quotes, escapes, globs, braces, ~, =, $, redirects or chaining), so this gate reads exactly what runs.',
    );
  }

  // Only the plugin's own copy: a copy written elsewhere skips the script's checks.
  const path = command.trim().split(/\s+/)[1];
  const root = deps.pluginRoot();
  if (!root || path !== `${root}/${SCRIPT_REL}`) {
    return deny(ctx, input, `Run the plugin's own post-review.mjs (${root ? `${root}/${SCRIPT_REL}` : 'CLAUDE_PLUGIN_ROOT is unset, so nothing posts'}), not a copy.`);
  }

  if (REPO_FLAG.test(command)) {
    return deny(ctx, input, 'post-review.mjs posts to the current repo only: no --repo or -R.');
  }
  const optIn = deps.readOptIn(input.transcript_path, input.tool_use_id);
  if (!optIn.post) {
    return deny(
      ctx,
      input,
      'review-pr never posts unless the user typed --post on /ork:review-pr. Print the review and stop; the user posts it or re-runs with --post.',
    );
  }
  const pr = callPr(command);
  if (pr === null || !optIn.prs.includes(pr)) {
    return deny(
      ctx,
      input,
      `post-review.mjs must name the PR the user typed (${optIn.prs.length ? optIn.prs.join(', ') : 'none typed'}) with --pr, exactly as typed (a number, or the same github.com pull URL). A post needs the PR on the /ork:review-pr line.`,
    );
  }
  // gh resolves a bare number against the cwd's repo. Post only from the
  // session project root, so a cd into a nested repo cannot retarget it.
  if (PR_NUM.test(pr) && !sameDir(input.cwd, ctx.projectDir)) {
    return deny(
      ctx,
      input,
      `A bare PR number resolves against the current directory's repo, and the shell is not at the session project root (${ctx.projectDir || 'unknown'}). cd back to it, or have the user type the full github.com pull URL.`,
    );
  }
  if (/post-verdict|approve|request-changes/i.test(command) && !optIn.postVerdict) {
    return deny(
      ctx,
      input,
      'A verdict post (an approve or request-changes event, or a LAND, HOLD or XREVIEW line) needs --post-verdict typed by the user. Post as a comment without the verdict, or print it and stop.',
    );
  }
  ctx.log(HOOK, `post allowed: user opt-in present for PR ${pr}`);
  return outputSilentSuccess();
}
