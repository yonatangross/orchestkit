/**
 * Review Post Gate (skill-scoped PreToolUse on Bash and Write|Edit|NotebookEdit,
 * /ork:review-pr only)
 *
 * #4675: /ork:review-pr posted a review nobody asked for. This gate makes
 * posting opt-in in code, not in prose.
 *
 * The boundary is post and write (operator word on HOLD 6097396720, "Reads not
 * a boundary"). The Bash read rules below are defense in depth only: the Read,
 * Grep and Glob tools and a recursive read through a parent dir are out of
 * scope, so no read-side gate is built for them. The GitHub write surface is an
 * allowlist (#4678 HOLDs at bce3afb6):
 *
 *   1. gh runs only the reads in the Bash allowlist (pr view/diff/checks/list,
 *      issue view/list, repo view, run view/list, label list, release
 *      view/list, workflow view/list, and gh api as a plain GET).
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
 * Known limit: it reads the command TEXT and matches only Bash, Monitor,
 * Write, Edit, NotebookEdit and MCP calls. node, python3 and bash run only the
 * skill's own scripts, so a renamed copy or a script the model wrote does not
 * run; a post from the Skill, SendMessage, Agent or Workflow tools is not
 * seen. It stops an over-eager post, not a model set on getting around
 * it; #4677 removes the write credential, which is the fail-closed layer.
 */

import { statSync } from 'node:fs';
import type { HookContext, HookInput, HookResult } from '../types.js';
import { outputDeny, outputSilentSuccess } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';
import { chainUserCommandArgs } from '../lib/review-opt-in.js';
import { tmpdir } from 'node:os';
import { posix } from 'node:path';
import { hasLink, realPath } from '../lib/real-path.js';
import { inGitRepo } from '../lib/repo-root.js';

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
      else if (quote === '"' && c === '\\' && k + 1 < text.length) {
        k += 1;
        cur += text[k];
      }
    } else if (c === "'" || c === '"') {
      quote = c;
      cur += c;
    } else if (c === '\\' && k + 1 < text.length) {
      k += 1;
      cur += c + text[k];
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
function isAwkFieldPrint(program: string): boolean {
  // No nested quantifiers (CodeQL ReDoS at 41ed231d): collapse blanks, then split.
  const m = program.replace(/\s+/g, ' ').trim().match(/^\{ ?print\b([^;}]*);? ?\}$/);
  if (!m) return false;
  const fields = m[1].trim();
  return fields === '' || fields.split(/ ?, ?| /).every((f) => /^\$(?:\d+|NF)$/.test(f));
}

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
    return isAwkFieldPrint(args[k] ?? '') ? null : why;
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
  /** The real path (symlinks and firmlinks resolved), for the path compares. */
  realpath?: (p: string) => string;
  /** XDG_CONFIG_HOME, '' when unset (git then reads ~/.config/git). */
  xdgConfig?: () => string;
  /** CLAUDE_JOB_DIR, '' when unset: verdict_writeback.py writes there. */
  jobDir?: () => string;
  /** The temp dirs a write or read may use: /tmp and the process tmpdir. */
  tempDirs?: () => string[];
  /** Config and PATH dirs the environment names: never temp (HOLD 6096693701). */
  configEnv?: () => string[];
  /** The config subset of configEnv (no PATH lists): never read, in the repo either. */
  secretEnv?: () => string[];
}

const DEFAULT_DEPS: ReviewPostGateDeps = {
  readOptIn,
  pluginRoot: () => (process.env.CLAUDE_PLUGIN_ROOT ?? '').trim().replace(/\/+$/, ''),
  home: () => process.env.HOME ?? '',
  cdpath: () => process.env.CDPATH ?? '',
  xdgConfig: () => process.env.XDG_CONFIG_HOME ?? '',
  jobDir: () => process.env.CLAUDE_JOB_DIR ?? '',
  tempDirs: () => ['/tmp', tmpdir()],
  configEnv: () => envConfigDirs(process.env),
  secretEnv: () => envConfigDirs(process.env, false),
  realpath: realPath,
};

/**
 * The config, startup and PATH files and dirs an environment names: a write
 * there runs later, a read there can be a token (HOLD 6096848217). The whole
 * XDG config, data and state dirs count: git/credentials and gh tokens live
 * there (product-10 at 789ed83e).
 */
export function envConfigDirs(env: NodeJS.ProcessEnv, lists = true): string[] {
  const xdg = (env.XDG_CONFIG_HOME ?? '').replace(/\/+$/, '');
  const one = [env.GIT_CONFIG_GLOBAL, env.GIT_CONFIG_SYSTEM, env.GH_CONFIG_DIR, env.ZDOTDIR, env.BASH_ENV, env.ENV, xdg, env.XDG_DATA_HOME, env.XDG_STATE_HOME];
  // An empty PATH or PYTHONPATH entry is the cwd, so it is named as '.'.
  const dirs = lists ? [env.PATH, env.PYTHONPATH].flatMap((v) => (v ? v.split(':').map((e) => e || '.') : [])) : [];
  return [...one, ...dirs].filter((d): d is string => !!d);
}

/**
 * The named config set as roots: configEnv and $XDG_CONFIG_HOME. A relative
 * value is resolved against the cwd, as gh and git resolve it; null when one
 * cannot be resolved, which the callers read as no temp at all (codex XREVIEW
 * 6097088920 P1).
 */
function namedRoots(deps: ReviewPostGateDeps, rp: (p: string) => string, cwd: string, env = deps.configEnv): string[] | null {
  const xdg = (deps.xdgConfig?.() ?? '').replace(/\/+$/, '');
  // bash expands a leading ~/ in a PATH entry at lookup, so HOME resolves it.
  const home = (deps.home?.() ?? '').replace(/\/+$/, '');
  const values = [...(env?.() ?? []), ...(xdg ? [xdg] : [])].map((v) => (v.startsWith('~/') && home.startsWith('/') ? `${home}${v.slice(1)}` : v));
  // git also expands ~user/, which the gate cannot resolve: fail closed
  // (codex22 XREVIEW 6097518008 P2).
  if (values.some((v) => v.startsWith('~'))) return null;
  if (values.some((v) => !v.startsWith('/')) && !cwd.startsWith('/')) return null;
  return tempRoots(values.map((v) => (v.startsWith('/') ? v : posix.join(cwd, v))), rp);
}

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
  return abs === null ? null : posix.normalize(abs).replace(/^\/system\/volumes\/data(?=\/)/, '').replace(/(.)\/+$/, '$1');
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
  const code = root ? [`${root}/hooks`, `${root}/skills/review-pr`] : [];
  // A protected dir may itself be a symlink: compare its real path too.
  const real = (d: string) => (deps.realpath ? deps.realpath(d).toLowerCase() : d);
  return { configDirs: [...new Set([...config].flatMap((d) => [d, real(d)]))], codeDirs: [...new Set(code.flatMap((d) => [d, real(d)]))] };
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

/**
 * A file whose text git or Claude Code later runs as a command: the git dir
 * (config, hooks), attributes and modules, the user's git config, and the
 * project's Claude settings and MCP config. A write there steers a later
 * allowlisted read into a post (HOLD 6095191454). p is lowercase.
 */
function steersCommand(p: string, home: string, xdg: string): boolean {
  const parts = p.split('/');
  const base = parts[parts.length - 1];
  if (parts.includes('.git') || ['.gitattributes', '.gitmodules', '.mcp.json'].includes(base)) return true;
  if (parts[parts.length - 2] === '.claude' && /^settings(?:\.[\w-]+)?\.json$/.test(base)) return true;
  if (home && p === `${home}/.gitconfig`) return true;
  const configHome = xdg || (home ? `${home}/.config` : '');
  const gitDir = configHome ? `${configHome.replace(/\/+$/, '')}/git` : '';
  return gitDir !== '' && (p === gitDir || p.startsWith(`${gitDir}/`));
}

/**
 * Whether a real path is the real path of a file steersCommand protects by
 * name: a protected name can be a link to an ordinary-named file, which git
 * still reads as config (codex22 XREVIEW 6095395160 P2-1). real is lowercase.
 */
function reachesConfig(real: string, cwd: string, deps: ReviewPostGateDeps): boolean {
  const rp = deps.realpath;
  if (!rp) return false;
  const home = (deps.home?.() ?? '').replace(/\/+$/, '');
  const configHome = (deps.xdgConfig?.() ?? '').replace(/\/+$/, '') || (home ? `${home}/.config` : '');
  const named = [home && `${home}/.gitconfig`, configHome && `${configHome}/git`];
  if (cwd) named.push(...['.git', '.git/config', '.git/hooks', '.git/info', '.gitattributes', '.gitmodules', '.mcp.json', '.claude/settings.json', '.claude/settings.local.json'].map((n) => `${cwd}/${n}`));
  return named.some((n) => {
    if (!n) return false;
    const t = rp(n).toLowerCase();
    return real === t || real.startsWith(`${t}/`);
  });
}

/**
 * The temp dirs as typed and by real path, lowercase: the temp dir itself,
 * never all of /var/folders, where caches live (codex22 XREVIEW 6095963428 P2).
 */
function tempRoots(dirs: string[], rp: (p: string) => string): string[] {
  const all = dirs.filter((d) => d.startsWith('/')).flatMap((d) => [posix.normalize(d), rp(d)]);
  return [...new Set(all.map((d) => d.replace(/\/+$/, '').toLowerCase()).filter((d) => d !== ''))];
}

/**
 * Whether a temp path names a git-dir member below its temp root: HEAD,
 * config or packed-refs, or a name under objects/, refs/, hooks/ or info/.
 * By name, so the order the members are written in does not matter (HOLD
 * 6096693701 must 1).
 */
function gitMember(real: string, temps: string[]): boolean {
  const l = real.toLowerCase();
  const root = temps.filter((r) => l.startsWith(`${r}/`)).sort((a, b) => b.length - a.length)[0];
  if (root === undefined) return false;
  const names = l.slice(root.length + 1).split('/');
  const base = names[names.length - 1];
  return ['head', 'config', 'packed-refs'].includes(base) || names.slice(0, -1).some((n) => ['objects', 'refs', 'hooks', 'info'].includes(n));
}

/** Whether a path names a .claude dir anywhere: skills, agents and commands load from there. */
function dotClaude(x: string): boolean {
  return x.toLowerCase().split('/').includes('.claude');
}

/** Whether a path is a CLAUDE.md or CLAUDE.local.md, which a session loads as instructions. */
function claudeMd(x: string): boolean {
  return /^claude(?:\.local)?\.md$/i.test(posix.basename(x));
}

/** The link count of an existing file, 0 when it is absent or cannot be read. */
function linkCount(x: string): number {
  try {
    return statSync(x).nlink;
  } catch {
    // broad: fail-open: an absent target has no other name.
    return 0;
  }
}

/**
 * The job dir as a root, lowercase, or '' when a write there could run later:
 * a link in its names, HOME or a dotfile dir under it, a .claude dir, or a git
 * work tree (codex 6096633483 P2). Write and verdict_writeback.py both use it
 * (HOLD 6097900519 should 3).
 */
function jobRootOk(deps: ReviewPostGateDeps, rp: (p: string) => string, home: string, temps: string[]): string {
  const job = (deps.jobDir?.() ?? '').replace(/\/+$/, '');
  if (!job.startsWith('/') || job.split('/').includes('..') || hasLink(job, 1) || dotClaude(job)) return '';
  const root = rp(job).toLowerCase();
  const homes = home.startsWith('/') ? tempRoots([home], rp) : [];
  if (homes.includes(root) || homes.some((h) => root.startsWith(`${h}/.`)) || dotClaude(root)) return '';
  return inGitRepo(rp(job), { home, temps }) ? '' : root;
}

/** Whether x is a root in roots, or below one (strict: below only). */
function underAny(x: string, roots: string[], strict = false): boolean {
  const l = x.toLowerCase();
  return roots.some((r) => (!strict && l === r) || l.startsWith(`${r}/`));
}

const DEFAULT_TEMP = () => ['/tmp', tmpdir()];
const WRITE_DENY =
  'review-pr writes only in the temp dir, <repo>/.claude/chain/ or $CLAUDE_JOB_DIR, by real path: any other file can be one a later step runs. Write the review body to a temp file.';

/**
 * Write is an allowlist (HOLD 6095687461 must 2): every name added to a
 * denylist left the next file a later step runs. Both the path as typed and
 * its normalized spelling are real-pathed, since the kernel and a text
 * normalizer read x/../y differently when x is a link (should 3).
 */
function writeAllowed(fp: unknown, cwd: string, deps: ReviewPostGateDeps): boolean {
  if (typeof fp !== 'string' || fp === '') return false;
  const rp = deps.realpath ?? ((x: string) => x);
  const home = (deps.home?.() ?? '').replace(/\/+$/, '');
  const typed = fp.startsWith('~/') && home ? `${home}${fp.slice(1)}` : fp;
  if (!typed.startsWith('/') && !cwd) return false;
  const raw = typed.startsWith('/') ? typed : `${cwd}/${typed}`;
  // A root counts only where it is spelled: a link at it or in a parent
  // (.claude/chain -> .github/workflows, job-parent -> .github) would move the
  // allowed dir (codex22 XREVIEW 6095963428 P1, 6096089850 P1). The chain root
  // is checked below the cwd, the job dir below its first name.
  const fixed = (r: string, anchor: string) => {
    if (r.split('/').includes('..')) return '';
    const skip = anchor === '/' ? 1 : anchor.split('/').filter((n) => n !== '').length;
    return hasLink(r, skip) ? '' : rp(r).toLowerCase();
  };
  const temps = tempRoots(deps.tempDirs?.() ?? DEFAULT_TEMP(), rp);
  const bounds = { home, temps };
  const base = posix.normalize(cwd).replace(/\/+$/, '');
  const homes = home.startsWith('/') ? tempRoots([home], rp) : [];
  // The job dir counts only where a write there runs nothing (jobRootOk).
  const jobRoot = jobRootOk(deps, rp, home, temps);
  const chain = base && inGitRepo(base, bounds) ? fixed(`${base}/.claude/chain`, base) : '';
  const roots = [chain, jobRoot].filter((r) => r !== '');
  // A dir the environment names as config or PATH is not temp, wherever it is.
  const named = namedRoots(deps, rp, cwd);
  if (named === null) return false;
  // A temp path inside a git work tree (a checkout or worktree under /tmp) is
  // that repo's file, which a project hook may run (HOLD 6096088108 must 1).
  // A HOME under a temp dir (a container, a CI box) is HOME, never temp: its
  // shell profile and gh config would be writable (HOLD 6096491908 must 1).
  // Named dirs and git-dir members deny first, under an allowed root too: a
  // job dir on PATH would let a write plant a command (codex 6096802137 P2).
  // A .claude path is a skill, agent, command or settings file a later step
  // loads, so only the chain dir of a repo cwd is written there, in a temp
  // dir too (HOLD 6097900519 must 1).
  // Below the chain root no further .claude dir counts, by real path and by
  // spelling (HOLD 6098152787 must, p10n).
  const claudeIn = (x: string) => x.toLowerCase().split('/').filter((n) => n === '.claude').length;
  const inChain = (x: string, real: string) => chain !== '' && underAny(real, [chain]) && !dotClaude(real.slice(chain.length)) && claudeIn(x) <= claudeIn(base) + 1;
  const ok = (x: string, real: string) =>
    !underAny(real, named) && !gitMember(real, [...temps, ...roots]) && !claudeMd(x) && !claudeMd(real) && (inChain(x, real) || (!dotClaude(x) && !dotClaude(real) && (underAny(real, [jobRoot].filter((r) => r !== '')) || (underAny(real, temps) && !underAny(real, homes) && !inGitRepo(posix.dirname(real), bounds)))));
  // A file with another hard link is that other file too, which may be one a
  // later step runs (codex XREVIEW 6098111473 P2).
  if (linkCount(raw) > 1) return false;
  return [raw, posix.normalize(raw)].every((x) => ok(x, rp(x)));
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
    // realPath gets the path as typed: it resolves a link before a .. after
    // it, as the kernel does; the normalized p would drop the link first.
    const raw = typeof fp === 'string' ? (fp.startsWith('/') ? fp : `${input.cwd ?? ''}/${fp}`) : '';
    const real = p !== null && deps.realpath ? deps.realpath(raw).toLowerCase() : null;
    const hit = p === null ? null : (targetOf(p, targets) ?? (real ? targetOf(real, targets) : null));
    const isTranscript = typeof fp === 'string' && typeof input.transcript_path === 'string' && pathFold(fp) === pathFold(input.transcript_path);
    if (hit === 'config' || isTranscript) return deny(ctx, input, TRANSCRIPT_DENY);
    if (hit === 'code' || (typeof fp === 'string' && /(?:^|\/)post-review\.mjs$/i.test(fp))) {
      return deny(ctx, input, 'review-pr may not write the hook code, post-review.mjs or its own skill dir: the post gate runs from them.');
    }
    const home = (deps.home?.() ?? '').toLowerCase().replace(/\/+$/, '');
    const xdg = (deps.xdgConfig?.() ?? '').toLowerCase();
    const homeReal = home && deps.realpath ? deps.realpath(home).toLowerCase() : home;
    // The normalized spelling is real-pathed too: x/../cfg is <cwd>/cfg by
    // text but <x's parent>/cfg to the kernel (HOLD 6095687461 should 3).
    const realNorm = real !== null && deps.realpath ? deps.realpath(posix.normalize(raw)).toLowerCase() : null;
    const steers = (x: string | null) => x !== null && (steersCommand(x, home, xdg) || steersCommand(x, homeReal, xdg) || reachesConfig(x, input.cwd ?? '', deps));
    if (p !== null && (steersCommand(p, home, xdg) || steers(real) || steers(realNorm))) {
      return deny(ctx, input, 'review-pr may not write git config, git hooks, attributes, or the project Claude settings or .mcp.json: a later read would run what they name.');
    }
    return writeAllowed(fp, input.cwd ?? '', deps) ? outputSilentSuccess() : deny(ctx, input, WRITE_DENY);
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
  const allowCtx: AllowContext = { cwd: input.cwd ?? '', root: deps.pluginRoot(), realpath: deps.realpath ?? ((x: string) => x), home: deps.home?.() ?? '', tempDirs: tempRoots(deps.tempDirs?.() ?? DEFAULT_TEMP(), deps.realpath ?? ((x: string) => x)), named: namedRoots(deps, deps.realpath ?? ((x: string) => x), input.cwd ?? ''), secret: namedRoots(deps, deps.realpath ?? ((x: string) => x), input.cwd ?? '', deps.secretEnv ?? deps.configEnv) };
  // The job dir must pass the Write rule; unset, "$CLAUDE_JOB_DIR" is empty and
  // verdict_writeback.py would write into the cwd (HOLD 6098152787 should).
  allowCtx.jobOk = jobRootOk(deps, allowCtx.realpath, allowCtx.home ?? '', allowCtx.tempDirs ?? []) !== '';
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
    if (/[<>]/.test(quiet) || allowlistReason(quiet, allowCtx) !== null) {
      return deny(ctx, input, 'review-pr may only read the gate code (hooks, skills/review-pr): the post gate runs from it.');
    }
  }
  // A literal skill-dir variable means Claude Code did not substitute it; say
  // so instead of the reason a later rule would give (HOLD 6086210644 should 5).
  if (/\$\{?CLAUDE_SKILL_DIR\b/.test(command)) {
    return deny(ctx, input, 'review-pr: $CLAUDE_SKILL_DIR was not substituted in this command. Use the absolute skill path the loaded skill shows, as one plain call.');
  }
  const why = rawWriteReason(command);
  if (why) {
    return deny(
      ctx,
      input,
      `review-pr runs gh read-only (${why} is a write). Posts go through scripts/post-review.mjs, and only when the user typed --post. Do not retry another way: print the review and stop.`,
    );
  }
  if (!GUARD_SCRIPT.test(command)) {
    const notListed = allowlistReason(command, allowCtx);
    if (notListed) return deny(ctx, input, `${ALLOW_DENY} (${notListed}).`);
    return outputSilentSuccess();
  }
  if (!GUARD_CALL.test(command.trim())) {
    // Named but not run as `node <path>/post-review.mjs`: only a pure read is
    // fine, every segment a read and no redirect, so the file cannot reach node
    // on stdin (cat <script> | node -) or be copied (HOLD 6079468845, Codex P1).
    const quiet = command.replace(/\s2>(?:\/dev\/null|&1)(?=\s|$)/g, ' ');
    if (!/[<>]/.test(quiet) && segments(quiet).every(isReadOnly) && allowlistReason(command, allowCtx) === null) return outputSilentSuccess();
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

// ---------------------------------------------------------------------------
// ALLOWLIST (HOLD 6085798647, the floor's design change). Six rounds showed a
// denylist over shell text cannot close this class. While the gate is armed,
// a Bash or Monitor call passes only when it parses cleanly into simple
// commands from a fixed read-only set; everything else denies.
// ---------------------------------------------------------------------------

interface Word {
  /** The word as bash passes it: quotes removed. */
  text: string;
  /** An unquoted glob character (* ? [) is in the word. */
  glob: boolean;
  /** A plain $NAME is in the word. */
  variable: boolean;
}

type Tokens = { ok: true; commands: Word[][] } | { ok: false; why: string };

const NAME_CHAR = /[A-Za-z0-9_]/;

/**
 * Split a command line into simple commands of words. Refused, with a reason:
 * any expansion but a plain $NAME ($( ), backticks, ${ }, $'', $"", <( )),
 * a subshell or group, a heredoc or any redirect but 2>/dev/null, >/dev/null
 * and 2>&1, a background &, a tilde, an unquoted backslash or comment, an
 * unterminated quote. Separators: ; && || | and newline.
 */
export function tokenizeAllowed(command: string): Tokens {
  const commands: Word[][] = [];
  let words: Word[] = [];
  let cur = '';
  let started = false;
  let glob = false;
  let variable = false;
  const endWord = () => {
    if (started) words.push({ text: cur, glob, variable });
    cur = '';
    started = false;
    glob = false;
    variable = false;
  };
  const endCommand = () => {
    endWord();
    if (words.length) commands.push(words);
    words = [];
  };
  const dollar = (s: string, k: number): number => {
    // A plain $NAME only; returns the index after it, or -1.
    let j = k + 1;
    while (j < s.length && NAME_CHAR.test(s[j])) j += 1;
    return j > k + 1 && /[A-Za-z_]/.test(s[k + 1]) ? j : -1;
  };
  const text = command.replace(/\\\n/g, '');
  let k = 0;
  while (k < text.length) {
    const c = text[k];
    if (c === "'") {
      const end = text.indexOf("'", k + 1);
      if (end < 0) return { ok: false, why: 'an unterminated quote' };
      cur += text.slice(k + 1, end);
      started = true;
      k = end + 1;
      continue;
    }
    if (c === '"') {
      let j = k + 1;
      for (; j < text.length && text[j] !== '"'; j += 1) {
        const d = text[j];
        if (d === '`') return { ok: false, why: 'a command substitution' };
        if (d === '\\') {
          j += 1;
          if (j < text.length) cur += /["\\$]/.test(text[j]) ? text[j] : `\\${text[j]}`;
          continue;
        }
        if (d === '$') {
          const after = dollar(text, j);
          if (after < 0) return { ok: false, why: 'an expansion other than a plain $NAME' };
          cur += text.slice(j, after);
          variable = true;
          j = after - 1;
          continue;
        }
        cur += d;
      }
      if (j >= text.length) return { ok: false, why: 'an unterminated quote' };
      started = true;
      k = j + 1;
      continue;
    }
    if (c === ' ' || c === '\t') {
      endWord();
      k += 1;
      continue;
    }
    if (c === '\n' || c === ';') {
      endCommand();
      k += 1;
      continue;
    }
    if (c === '|') {
      if (text[k + 1] === '&') return { ok: false, why: 'a |& pipe' };
      endCommand();
      k += text[k + 1] === '|' ? 2 : 1;
      continue;
    }
    if (c === '&') {
      if (text[k + 1] !== '&') return { ok: false, why: 'a background & or an &> redirect' };
      endCommand();
      k += 2;
      continue;
    }
    if (c === '>' || c === '<') {
      // Only 2>/dev/null, >/dev/null, 1>/dev/null and 2>&1, as one word.
      const fd = started && /^\d$/.test(cur) ? cur : '';
      const m = text.slice(k).match(/^(>\/dev\/null|>&1)(?=[\s;&|]|$)/);
      if (c === '<' || !m || (m[1] === '>&1' && fd !== '2') || (fd && !/^[12]$/.test(fd))) {
        return { ok: false, why: 'a redirect other than 2>/dev/null, >/dev/null or 2>&1' };
      }
      if (fd) {
        cur = '';
        started = false;
      } else {
        endWord();
      }
      k += m[1].length;
      continue;
    }
    if (c === '$') {
      // Unquoted, bash splits the value into words, so a value the gate cannot
      // see can add flags (X='-X POST'); quoted, it stays one word (HOLD 6087117284).
      return { ok: false, why: dollar(text, k) < 0 ? 'an expansion other than a plain $NAME' : 'an unquoted $NAME (bash splits it into words; quote it)' };
    }
    if ('`(){}\\!'.includes(c)) return { ok: false, why: `an unquoted ${c}` };
    if (c === '#' && !started) return { ok: false, why: 'a comment' };
    if (c === '~' && !started) return { ok: false, why: 'a tilde' };
    if ('*?['.includes(c)) glob = true;
    cur += c;
    started = true;
    k += 1;
  }
  endCommand();
  return { ok: true, commands };
}

// FLAGS BY ALLOWLIST (HOLD 6086210644): a flag can run a program (rg
// --hostname-bin, --pre) or write a file (sort -o), so each allowed command
// has a fixed list of flags, and any other flag denies. A flag either takes
// no value, a number, or text that is not a path (no listed flag reads or
// writes a file).
type ArgKind = 'num' | 'text' | 'field';
interface FlagSpec {
  /** Short flags with no value, as one string of letters. */
  shortNone: string;
  shortArg: Record<string, ArgKind>;
  longNone: readonly string[];
  longArg: Record<string, ArgKind>;
  /** -NUM is a count (head -20, grep -3, git log -5). */
  numeric?: boolean;
}
const spec = (shortNone: string, shortArg: Record<string, ArgKind>, longNone: readonly string[], longArg: Record<string, ArgKind> = {}, numeric = false): FlagSpec => ({
  shortNone,
  shortArg,
  longNone,
  longArg,
  numeric,
});
const NUM = 'num' as const;
const TEXT = 'text' as const;
// gh api -F key=@file reads a file into the request, so an @ value denies.
const FIELD = 'field' as const;
const GH_OUT = { json: TEXT, jq: TEXT, template: TEXT, repo: TEXT };
const GH_OUT_SHORT = { q: TEXT, t: TEXT, R: TEXT };
const GREP_LONG = ['color', 'colour', 'recursive', 'line-number', 'ignore-case', 'files-with-matches', 'files-without-match', 'count', 'invert-match', 'word-regexp', 'line-regexp', 'only-matching', 'quiet', 'silent', 'no-messages', 'no-filename', 'with-filename', 'extended-regexp', 'fixed-strings', 'perl-regexp', 'null', 'text'];
const FLAGS: Record<string, FlagSpec> = {
  ls: spec('lahAR1trSdFGpisnog', {}, ['all', 'almost-all', 'human-readable', 'recursive', 'directory', 'reverse']),
  cat: spec('nbsvetAET', {}, ['number', 'number-nonblank', 'squeeze-blank', 'show-all']),
  head: spec('qv', { n: NUM, c: NUM }, ['quiet', 'silent', 'verbose'], { lines: NUM, bytes: NUM }, true),
  tail: spec('qvr', { n: NUM, c: NUM }, ['quiet', 'silent', 'verbose'], { lines: NUM, bytes: NUM }, true),
  wc: spec('lwcmL', {}, ['lines', 'words', 'bytes', 'chars', 'max-line-length']),
  // No grep -R or rg -L/--follow: they follow links while they walk a dir.
  grep: spec('rniIlLcvwxoqshHEFPaz', { e: TEXT, A: NUM, B: NUM, C: NUM, m: NUM }, GREP_LONG, { regexp: TEXT, context: NUM, 'after-context': NUM, 'before-context': NUM, 'max-count': NUM, include: TEXT, exclude: TEXT, 'exclude-dir': TEXT }, true),
  rg: spec(
    'niIsSlcvwxoquUFPHNa.0',
    { e: TEXT, t: TEXT, T: TEXT, g: TEXT, A: NUM, B: NUM, C: NUM, m: NUM, M: NUM, d: NUM, j: NUM, r: TEXT },
    [...GREP_LONG, 'case-sensitive', 'smart-case', 'count-matches', 'hidden', 'no-ignore', 'multiline', 'json', 'files', 'heading', 'no-heading', 'vimgrep', 'column', 'no-line-number', 'trim', 'passthru', 'unrestricted', 'type-list'],
    { regexp: TEXT, type: TEXT, 'type-not': TEXT, glob: TEXT, iglob: TEXT, context: NUM, 'after-context': NUM, 'before-context': NUM, 'max-count': NUM, 'max-columns': NUM, 'max-depth': NUM, threads: NUM, replace: TEXT, sort: TEXT, sortr: TEXT, colors: TEXT },
  ),
  sort: spec('rnufbdghiMRVscCz', { k: TEXT, t: TEXT }, ['reverse', 'numeric-sort', 'unique', 'ignore-case', 'ignore-leading-blanks', 'dictionary-order', 'general-numeric-sort', 'human-numeric-sort', 'month-sort', 'version-sort', 'stable', 'check', 'zero-terminated'], { key: TEXT, 'field-separator': TEXT }),
  uniq: spec('cdui', { f: NUM, s: NUM, w: NUM }, ['count', 'repeated', 'unique', 'ignore-case'], { 'skip-fields': NUM, 'skip-chars': NUM, 'check-chars': NUM }),
  cut: spec('sn', { d: TEXT, f: TEXT, c: TEXT, b: TEXT }, ['only-delimited', 'complement'], { delimiter: TEXT, fields: TEXT, characters: TEXT, bytes: TEXT, 'output-delimiter': TEXT }),
  tr: spec('cCds', {}, ['complement', 'delete', 'squeeze-repeats']),
  nl: spec('', { b: TEXT, n: TEXT, w: NUM, s: TEXT, v: NUM, i: NUM }, []),
  // No jq -n: input comes from a file or a pipe (HOLD 6087117284).
  jq: spec('rjcseSCMaR', {}, ['raw-output', 'join-output', 'compact-output', 'slurp', 'exit-status', 'sort-keys', 'color-output', 'monochrome-output', 'ascii-output', 'raw-input', 'tab', 'seq'], { indent: NUM }),
  awk: spec('', { F: TEXT }, []),
  'gh pr view': spec('c', GH_OUT_SHORT, ['comments'], GH_OUT),
  'gh pr diff': spec('', { R: TEXT }, ['name-only', 'patch', 'color'], { repo: TEXT }),
  'gh pr checks': spec('', { ...GH_OUT_SHORT, i: NUM }, ['required', 'watch', 'fail-fast'], { ...GH_OUT, interval: NUM }),
  'gh pr list': spec('d', { ...GH_OUT_SHORT, s: TEXT, L: NUM, A: TEXT, a: TEXT, l: TEXT, B: TEXT, H: TEXT, S: TEXT }, ['draft'], { ...GH_OUT, state: TEXT, limit: NUM, author: TEXT, assignee: TEXT, label: TEXT, base: TEXT, head: TEXT, search: TEXT }),
  'gh issue view': spec('c', GH_OUT_SHORT, ['comments'], GH_OUT),
  'gh issue list': spec('', { ...GH_OUT_SHORT, s: TEXT, L: NUM, A: TEXT, a: TEXT, l: TEXT, S: TEXT }, [], { ...GH_OUT, state: TEXT, limit: NUM, author: TEXT, assignee: TEXT, label: TEXT, search: TEXT }),
  'gh repo view': spec('', { q: TEXT, t: TEXT, b: TEXT }, [], { json: TEXT, jq: TEXT, template: TEXT, branch: TEXT }),
  'gh run view': spec('v', { ...GH_OUT_SHORT, j: TEXT, a: NUM }, ['log', 'log-failed', 'exit-status', 'verbose'], { ...GH_OUT, job: TEXT, attempt: NUM }),
  'gh run list': spec('', { ...GH_OUT_SHORT, L: NUM, b: TEXT, w: TEXT, s: TEXT, c: TEXT, e: TEXT, u: TEXT }, ['all'], { ...GH_OUT, limit: NUM, branch: TEXT, workflow: TEXT, status: TEXT, commit: TEXT, event: TEXT, user: TEXT }),
  'gh release view': spec('', GH_OUT_SHORT, [], GH_OUT),
  'gh release list': spec('', { ...GH_OUT_SHORT, L: NUM }, ['exclude-drafts', 'exclude-pre-releases'], { ...GH_OUT, limit: NUM }),
  'gh workflow view': spec('y', { ...GH_OUT_SHORT, r: TEXT }, ['yaml'], { ...GH_OUT, ref: TEXT }),
  'gh workflow list': spec('a', { ...GH_OUT_SHORT, L: NUM }, ['all'], { ...GH_OUT, limit: NUM }),
  'gh label list': spec('', { ...GH_OUT_SHORT, L: NUM, S: TEXT }, [], { ...GH_OUT, limit: NUM, search: TEXT, order: TEXT, sort: TEXT }),
  // Fields pass only with an explicit GET (ghApiWrite); -F never with @.
  'gh api': spec('i', { q: TEXT, t: TEXT, H: TEXT, X: TEXT, f: TEXT, F: FIELD }, ['paginate', 'slurp', 'include', 'silent', 'verbose'], { jq: TEXT, template: TEXT, header: TEXT, method: TEXT, cache: TEXT, 'raw-field': TEXT, field: FIELD }),
  'git log': spec('p', { n: NUM, S: TEXT, G: TEXT, U: NUM }, ['oneline', 'graph', 'stat', 'shortstat', 'numstat', 'name-only', 'name-status', 'no-merges', 'merges', 'first-parent', 'reverse', 'all', 'patch', 'follow', 'no-color', 'abbrev-commit', 'no-ext-diff', 'no-textconv', 'decorate', 'no-decorate'], { format: TEXT, pretty: TEXT, since: TEXT, until: TEXT, after: TEXT, before: TEXT, author: TEXT, grep: TEXT, 'max-count': NUM, skip: NUM, date: TEXT, unified: NUM, 'diff-filter': TEXT }, true),
  'git diff': spec('pwbMR', { U: NUM }, ['stat', 'shortstat', 'numstat', 'name-only', 'name-status', 'cached', 'staged', 'no-color', 'patch', 'merge-base', 'ignore-all-space', 'ignore-space-change', 'find-renames', 'word-diff', 'check', 'minimal', 'no-ext-diff', 'no-textconv', 'no-renames'], { unified: NUM, 'diff-filter': TEXT }),
  'git show': spec('ps', { U: NUM }, ['stat', 'shortstat', 'numstat', 'name-only', 'name-status', 'oneline', 'no-patch', 'patch', 'no-color', 'abbrev-commit', 'no-ext-diff', 'no-textconv'], { format: TEXT, pretty: TEXT, unified: NUM }),
  'git status': spec('sbu', {}, ['short', 'branch', 'porcelain', 'long', 'ignored']),
  'git rev-parse': spec('q', {}, ['abbrev-ref', 'short', 'verify', 'show-toplevel', 'git-dir', 'git-common-dir', 'is-inside-work-tree', 'quiet', 'symbolic-full-name', 'show-prefix']),
  'git blame': spec('wseMCl', { L: TEXT }, ['porcelain', 'line-porcelain', 'show-email'], { date: TEXT }),
  'git ls-files': spec('cmodzs', {}, ['cached', 'modified', 'others', 'deleted', 'exclude-standard', 'error-unmatch', 'full-name', 'stage']),
  'git merge-base': spec('a', {}, ['is-ancestor', 'fork-point', 'all', 'octopus']),
  'git grep': spec('nilLcwvEFPhHIz', { e: TEXT, A: NUM, B: NUM, C: NUM, m: NUM }, ['cached', 'untracked', 'name-only', 'count', 'or', 'and', 'not', 'all-match', 'line-number', 'ignore-case', 'files-with-matches', 'word-regexp', 'invert-match', 'extended-regexp', 'fixed-strings', 'perl-regexp'], { 'max-depth': NUM, 'max-count': NUM, context: NUM }, true),
};
// Long flags whose value is optional and given only with = (--color, --porcelain=v2).
const LONG_OPTIONAL_VALUE = new Set(['color', 'colour', 'decorate', 'porcelain', 'word-diff', 'short', 'abbrev-ref', 'abbrev-commit', 'untracked', 'ignored']);

interface ParsedArgs {
  /** Words that are not flags or flag values, before a --. */
  positionals: Word[];
  /** Words after a --. */
  afterDash: Word[];
  /** Flags given, by name (single letter for a short flag). */
  given: Set<string>;
  /** Each value a flag took, as the parser took it. */
  values: Array<{ name: string; value: string }>;
}

/** A word bash can expand into a word that starts with - (a glob at its start). */
const leadingGlob = (w: Word): boolean => w.glob && /^[*?[]/.test(w.text);

function flagValue(name: string, kind: ArgKind, value: Word | string | undefined): string | null {
  if (value === undefined) return `the flag ${name} has no value`;
  const v = typeof value === 'string' ? value : value.text;
  if (typeof value !== 'string' && (value.variable || leadingGlob(value))) return `a variable or glob as the value of ${name}`;
  if (v.startsWith('~')) return `a tilde as the value of ${name}`;
  if (kind === NUM && !/^[+-]?\d+$/.test(v)) return `the flag ${name} takes a number`;
  if (kind === FIELD && /^[^=]*=@/.test(v)) return `${name} with an @ value reads a file`;
  return null;
}

/** Split the args of a command by its flag list; a flag not on the list is a reason. */
export function parseFlags(label: string, args: Word[], s: FlagSpec): ParsedArgs | string {
  const out: ParsedArgs = { positionals: [], afterDash: [], given: new Set(), values: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    const t = a.text;
    if (t === '--') {
      out.afterDash = args.slice(i + 1);
      return out;
    }
    if (leadingGlob(a)) return `a glob at the start of a word, which bash can expand into a flag (${t}); write ./${t} or put it after --`;
    if (t === '-' || !t.startsWith('-')) {
      // A quoted $NAME can expand to -X or --pre=sh, which the command reads
      // as a flag, or be its program; only after -- is it data (HOLD 6088683660).
      if (a.variable) return `a variable before -- (${t}), which the command can read as a flag or its program; put it after --`;
      out.positionals.push(a);
      continue;
    }
    if (a.variable) return `a variable in a flag (${t})`;
    if (t.startsWith('--')) {
      const eq = t.indexOf('=');
      const name = eq < 0 ? t.slice(2) : t.slice(2, eq);
      const kind = s.longArg[name];
      // An optional value comes only with =, so the next word is never taken
      // as a value the command would read as a path.
      if (LONG_OPTIONAL_VALUE.has(name) && s.longNone.includes(name)) {
        const why = eq < 0 ? null : flagValue(`--${name}`, TEXT, t.slice(eq + 1));
        if (why) return why;
        out.given.add(name);
        continue;
      }
      if (s.longNone.includes(name)) {
        if (eq >= 0) return `${label} --${name} takes no value`;
        out.given.add(name);
        continue;
      }
      if (!kind) return `${label} --${name} is not on the flags allowed for ${label}`;
      if (eq < 0) i += 1;
      const value = eq < 0 ? args[i] : t.slice(eq + 1);
      const why = flagValue(`--${name}`, kind, value);
      if (why) return why;
      out.given.add(name);
      out.values.push({ name, value: typeof value === 'string' ? value : (value?.text ?? '') });
      continue;
    }
    if (s.numeric && /^-\d+$/.test(t)) continue;
    for (let k = 1; k < t.length; k += 1) {
      const c = t[k];
      if (s.shortNone.includes(c)) {
        out.given.add(c);
        continue;
      }
      const kind = s.shortArg[c];
      if (!kind) return `${label} -${c} is not on the flags allowed for ${label}`;
      const glued = t.slice(k + 1);
      if (!glued) i += 1;
      const value = glued ? glued : args[i];
      const why = flagValue(`-${c}`, kind, value);
      if (why) return why;
      out.given.add(c);
      out.values.push({ name: c, value: typeof value === 'string' ? value : (value?.text ?? '') });
      break;
    }
  }
  return out;
}

// A jq program can read the environment (env, $ENV, $ ENV) or load a module
// from disk (import, include); jq has no eval, so a word check is complete.
const JQ_OUTSIDE = /\$\s*(?:ENV|__prog_args)\b|\b(?:env|import|include|get_search_list|get_jq_origin|get_prog_origin|modulemeta|input_filename)\b/;

function jqProgramReason(program: string | undefined): string | null {
  return program !== undefined && JQ_OUTSIDE.test(program) ? `a jq program that reads the environment or a module (${program})` : null;
}

/** Each path word must stay in the repo or the temp dir. */
function pathsOk(paths: Word[], ctx: AllowContext): string | null {
  for (const p of paths) {
    const why = pathOutside(p, ctx);
    if (why) return why;
  }
  return null;
}

// test's operators are its flags; test never reads a program or a file body.
const TEST_OPS = new Set(['-b', '-c', '-d', '-e', '-f', '-g', '-h', '-k', '-L', '-n', '-p', '-r', '-s', '-S', '-t', '-u', '-w', '-x', '-z', '-O', '-G', '-N', '-eq', '-ne', '-lt', '-le', '-gt', '-ge', '-nt', '-ot', '-ef', '-a', '-o']);
const GIT_READ = new Set(['log', 'diff', 'show', 'status', 'rev-parse', 'blame', 'ls-files', 'merge-base', 'grep']);
const SKILL_SCRIPTS: Record<string, string> = {
  node: 'collect-rules.mjs',
  python3: 'verdict_writeback.py',
  bash: 'resolve-target.sh',
};

export interface AllowContext {
  /** The call's cwd, the repo the paths must stay inside. */
  cwd: string;
  /** CLAUDE_PLUGIN_ROOT, '' when unset. */
  root: string;
  /** The real path of a path (symlinks and firmlinks resolved), or the path. */
  realpath: (p: string) => string;
  /** HOME: a cwd at or above it is no repo root. */
  home?: string;
  /** The temp roots (tempRoots), lowercase; /tmp and the process tmpdir when unset. */
  tempDirs?: string[];
  /** The named config set (namedRoots), lowercase: never read or written; null fails closed. */
  named?: string[] | null;
  /** The config subset (secretEnv, no PATH): never read, in the repo either; null fails closed. */
  secret?: string[] | null;
  /** Whether "$CLAUDE_JOB_DIR" is a dir Write may use (jobRootOk); the gate sets it, unset here counts as yes. */
  jobOk?: boolean;
}

/** Why a path argument leaves the repo cwd, or null. */
function pathOutside(arg: Word, ctx: AllowContext): string | null {
  const t = arg.text;
  if (arg.variable) return `a variable in a path (${t})`;
  if (t.startsWith('~')) return `a tilde path (${t})`;
  if (t.split('/').some((c) => c === '..')) return `a .. path (${t})`;
  // A glob's matches are not resolved through symlinks here (a committed link
  // dir or file can point out of the repo), so a path is read only by a name
  // the gate can resolve (conductor145 at 348161fb). rg -g filters instead.
  if (arg.glob) return `a glob in a path (${t}); name the file, or use rg -g`;
  if (!ctx.cwd) return 'no cwd to resolve paths against';
  if (!inGitRepo(ctx.cwd, { home: ctx.home, temps: ctx.tempDirs ?? tempRoots(DEFAULT_TEMP(), ctx.realpath) })) return `the cwd (${ctx.cwd}) is in no git repo, so there is no repo to read`;
  // The cwd is taken as the repo root, so it may not be the home dir or above it.
  const rootReal = ctx.realpath(posix.normalize(ctx.cwd)).replace(/\/+$/, '');
  const homeReal = ctx.home ? ctx.realpath(posix.normalize(ctx.home)) : '';
  if (rootReal === '' || (homeReal && (homeReal === rootReal || homeReal.startsWith(`${rootReal}/`)))) {
    return `the cwd (${ctx.cwd}) is the home dir or above it, not a repo`;
  }
  const abs = posix.normalize(t.startsWith('/') ? t : `${ctx.cwd}/${t}`);
  const root = posix.normalize(ctx.cwd);
  const inside = (p: string, base: string) => p === base || p.startsWith(`${base.replace(/\/$/, '')}/`);
  // The repo, or a temp dir (a fetched diff or JSON); checked by real path, so
  // a symlink in either cannot point out of it.
  const real = ctx.realpath(abs);
  const temps = ctx.tempDirs ?? tempRoots(DEFAULT_TEMP(), ctx.realpath);
  // HOME is never temp, even when it sits in a temp dir (HOLD 6096491908 must 1).
  const homes = ctx.home?.startsWith('/') ? tempRoots([ctx.home], ctx.realpath) : [];
  // A config dir the environment names is never read, in the repo or temp; a
  // PATH dir only stops being temp, since an empty PATH entry is the repo
  // (HOLD 6096848217 must 1). A value that cannot be resolved denies.
  if (ctx.named === null || ctx.secret === null) return `an environment config path the gate cannot resolve (no cwd), so ${t} is not read`;
  const named = ctx.named ?? [];
  const secret = ctx.secret ?? [];
  if (underAny(abs, secret) || underAny(real, secret)) return `a config path the environment names (${t})`;
  const temp = (x: string) => underAny(x, temps) && !underAny(x, homes) && !underAny(x, named);
  if (!(inside(abs, root) && inside(real, ctx.realpath(root))) && !(temp(abs) && temp(real))) {
    return `a path outside the repo and the temp dir (${t})`;
  }
  return null;
}

const REF = /^[A-Za-z0-9._/][A-Za-z0-9._/-]*$/;

/**
 * verdict_writeback.py writes into its dir, so the dir is the job dir Claude
 * Code made ("$CLAUDE_JOB_DIR", quoted) or a temp dir, never the repo, where
 * a committed link could aim the write at the transcript (HOLD 6087117284).
 */
function writebackArgs(rest: Word[], ctx: AllowContext): string | null {
  const words = [...rest];
  const at = words.findIndex((a) => a.text === '--entity-type');
  if (at >= 0) {
    if (!REF.test(words[at + 1]?.text ?? '') || words[at + 1].variable) return 'verdict_writeback.py --entity-type needs a plain name';
    words.splice(at, 2);
  }
  if (words.length !== 1) return 'verdict_writeback.py takes one review dir';
  const [d] = words;
  if (d.variable) {
    if (d.text !== '$CLAUDE_JOB_DIR') return `verdict_writeback.py takes "$CLAUDE_JOB_DIR" or a temp dir, not ${d.text}`;
    return ctx.jobOk === false ? 'verdict_writeback.py: $CLAUDE_JOB_DIR is a dir Write may not use (HOME, a dotfile or .claude dir, or a git work tree)' : null;
  }
  const temps = ctx.tempDirs ?? tempRoots(DEFAULT_TEMP(), ctx.realpath);
  const temp = (x: string) => underAny(x, temps, true);
  return d.text.startsWith('/') && !d.text.split('/').includes('..') && temp(d.text) && temp(ctx.realpath(d.text)) ? null : `verdict_writeback.py takes "$CLAUDE_JOB_DIR" or a temp dir, not ${d.text}`;
}

/**
 * collect-rules.mjs reads rules from --repo and the home dir, so --repo is
 * the cwd itself, --home is not given, and the other flags take a plain ref
 * (HOLD 6087117284 should 4).
 */
function collectRulesArgs(rest: Word[], ctx: AllowContext): string | null {
  for (let i = 0; i < rest.length; i += 1) {
    const t = rest[i].text;
    if (t === '--standards' || t === '--no-user') continue;
    const v = rest[i + 1];
    if (t === '--repo') {
      if (!v || v.variable || !v.text.startsWith('/') || v.text.split('/').includes('..')) return 'collect-rules.mjs --repo needs the absolute repo root';
      const repo = ctx.realpath(posix.normalize(v.text)).replace(/\/+$/, '');
      const cwd = ctx.realpath(posix.normalize(ctx.cwd)).replace(/\/+$/, '');
      // Only the cwd itself: any dir above it would read rules from outside the repo.
      if (!repo || cwd !== repo) return `collect-rules.mjs --repo must be this repo, the cwd (${v.text})`;
      i += 1;
      continue;
    }
    if (['--default-branch', '--pr-base', '--base-ref'].includes(t)) {
      if (!v || v.variable || !REF.test(v.text)) return `collect-rules.mjs ${t} needs a plain ref`;
      i += 1;
      continue;
    }
    return `collect-rules.mjs ${t} is not on its flag list`;
  }
  return null;
}

/** Why a simple command is not on the read-only allowlist, or null. */
export function notAllowed(words: Word[], ctx: AllowContext): string | null {
  const [first, ...args] = words;
  const cmd = first.text;
  if (/=/.test(cmd) && !first.text.startsWith('-')) return 'an environment assignment';
  if (first.variable || first.glob) return 'a command word built at run time';
  // sed only as one whole sed -n 'N,Mp' <file>: its one allowed flag is -n
  // (GNU sed's e command runs a shell, w writes a file).
  if (cmd === 'sed') {
    const ok = args.length === 3 && args[0].text === '-n' && /^\d+(?:,\d+)?p$/.test(args[1].text) && !leadingGlob(args[2]);
    return ok ? pathOutside(args[2], ctx) : "sed other than sed -n 'N,Mp' <file>";
  }
  if (cmd === 'test') {
    for (const a of args) {
      if (leadingGlob(a)) return `a glob at the start of a word (${a.text})`;
      if (a.text.startsWith('-') && !TEST_OPS.has(a.text)) return `test ${a.text} is not a test operator on the list`;
    }
    return pathsOk(args.filter((a) => !a.text.startsWith('-')), ctx);
  }
  if (cmd === 'jq') {
    // --arg and --argjson take a name and a value; the filter is the first positional.
    const rest: Word[] = [];
    for (let i = 0; i < args.length; i += 1) {
      if (/^--(?:arg|argjson)$/.test(args[i].text)) {
        const pair = args.slice(i + 1, i + 3);
        if (pair.length < 2 || pair.some((w) => w.variable || leadingGlob(w))) return `jq ${args[i].text} needs a plain name and value`;
        i += 2;
        continue;
      }
      rest.push(args[i]);
    }
    const p = parseFlags('jq', rest, FLAGS.jq);
    if (typeof p === 'string') return p;
    // The program is the first word that is not a flag, before or after --.
    const [program, ...files] = [...p.positionals, ...p.afterDash];
    if (program?.variable) return `a variable as the jq program (${program.text})`;
    const envWhy = jqProgramReason(program?.text);
    if (envWhy) return envWhy;
    return pathsOk(files, ctx);
  }
  if (cmd === 'gh') {
    let at = 0;
    while (at < args.length && /^(?:-R|--repo)$/.test(args[at].text)) at += 2;
    while (at < args.length && /^--repo=/.test(args[at].text)) at += 1;
    const lead = args.slice(0, at);
    if (lead.some((w) => w.variable || leadingGlob(w))) return 'gh -R needs a plain owner/repo';
    const [sub, verb] = args.slice(at).map((a) => a.text);
    const key = sub === 'api' ? 'gh api' : `gh ${sub ?? ''} ${verb ?? ''}`;
    const s = FLAGS[key];
    if (!s) return `${key.trim()} is not a gh read on the list`;
    const rest = args.slice(at + (sub === 'api' ? 1 : 2));
    const p = parseFlags(key, rest, s);
    if (typeof p === 'string') return p;
    // After -- a word is still the endpoint or a gh argument, never plain data.
    if (p.afterDash.some((w) => w.variable)) return `a variable as a ${key.trim()} argument`;
    for (const { name, value } of p.values) {
      const envWhy = name === 'q' || name === 'jq' ? jqProgramReason(value) : null;
      if (envWhy) return envWhy;
    }
    return sub === 'api' ? ghApiWrite(rest.map((a) => a.text).join(' ')) : null;
  }
  if (cmd === 'git') {
    const sub = args[0]?.text ?? '';
    if (sub === 'fetch') {
      const rest = args.slice(1).map((a) => a.text);
      return rest.length === 2 && rest[0] === 'origin' && /^[A-Za-z0-9._/-]+$/.test(rest[1]) && !rest[1].startsWith('-') ? null : 'git fetch other than git fetch origin <branch>';
    }
    if (!GIT_READ.has(sub)) return `git ${sub || '(an option)'} is not a git read on the list`;
    const p = parseFlags(`git ${sub}`, args.slice(1), FLAGS[`git ${sub}`]);
    if (typeof p === 'string') return p;
    // Words before -- are revisions; words after it are paths. git reads a
    // word before -- as a path when it is no revision, and git diff with a
    // path outside the repo diffs it as a plain file (--no-index), so a word
    // there may not leave the repo by spelling.
    // Out of a work tree git diff runs as --no-index, so each word there goes
    // through the same real-path check as a path (HOLD 6095191454 should 2).
    const outside = p.positionals.find((w) => w.text.split(/[/:]/).includes('..'));
    if (outside) return `a path outside the repo before -- in git ${sub} (${outside.text})`;
    return pathsOk([...p.positionals, ...p.afterDash], ctx);
  }
  // A quoted command word with a space ("gh pr view") is not a key here.
  const flags = /^[a-z]+$/.test(cmd) ? FLAGS[cmd] : undefined;
  if (flags) {
    const p = parseFlags(cmd, args, flags);
    if (typeof p === 'string') return p;
    if (cmd === 'tr') return [...p.positionals, ...p.afterDash].some((a) => a.variable) ? 'a variable in tr' : null;
    if (cmd === 'awk') {
      const [program, ...files] = [...p.positionals, ...p.afterDash];
      if (!program || !isAwkFieldPrint(program.text)) return 'an awk program other than a pure field print';
      return pathsOk(files, ctx);
    }
    const words = [...p.positionals, ...p.afterDash];
    if (cmd === 'uniq' && words.length > 1) return 'uniq writing a file';
    // grep's and rg's first positional is the pattern unless -e gives it (rg --files and --type-list take none).
    const patternFirst = (cmd === 'grep' || cmd === 'rg') && !['e', 'regexp', 'files', 'type-list'].some((f) => p.given.has(f));
    return pathsOk(patternFirst ? words.slice(1) : words, ctx);
  }
  // The skill's own scripts, by their exact pinned path, as one plain call.
  const script = SKILL_SCRIPTS[cmd];
  if (script && ctx.root && args[0]?.text === `${ctx.root}/skills/review-pr/scripts/${script}`) {
    const rest = args.slice(1);
    if (rest.some((a) => a.glob)) return 'a glob in a skill script call';
    // A script can echo its argument (resolve-target.sh does), so a variable
    // there could print a secret; only the writeback job dir is one (should 3).
    if (script !== 'verdict_writeback.py' && rest.some((a) => a.variable)) return 'a variable in a skill script call';
    if (script === 'verdict_writeback.py') return writebackArgs(rest, ctx);
    if (script === 'collect-rules.mjs') return collectRulesArgs(rest, ctx);
    return null;
  }
  return `${cmd} is not on the read-only list`;
}

/** Why a Bash command is not on the allowlist, or null when every simple command is. */
export function allowlistReason(command: string, ctx: AllowContext): string | null {
  const parsed = tokenizeAllowed(command);
  if (!parsed.ok) return parsed.why;
  if (parsed.commands.length === 0) return 'an empty command';
  for (const words of parsed.commands) {
    const why = notAllowed(words, ctx);
    if (why) return why;
  }
  return null;
}

const ALLOW_DENY =
  "review-pr runs Bash only as simple read-only commands, each with only the flags on its list: gh pr view|diff|checks|list, gh run view|list (CI is the test evidence: gh pr checks, gh run view <id> --log-failed), gh issue|repo|release|workflow view, gh api GET, a git read (log, diff, show, status, rev-parse, blame, ls-files, merge-base, grep), git fetch origin <branch>, jq, ls, cat, head, tail, wc, grep, rg, sed -n 'N,Mp', test, sort, uniq, cut, tr, nl, an awk field print, on paths in the repo or the temp dir, and the skill scripts by their pinned path. No project tests or builds, cd, assignments, subshells, expansions but a quoted '$NAME' after --, a jq program with env or $ENV, a glob in a path (use rg -g), a flag that follows links (rg -L, grep -R), or redirects but 2>/dev/null and 2>&1. Print what you need another way, or stop. Not allowed here";
