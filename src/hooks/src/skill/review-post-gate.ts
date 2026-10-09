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

const GUARD_SCRIPT = /\bpost-review\.mjs\b/;
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

const TRANSCRIPT_DIR = /\.claude\/projects\b/;
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
  return command.split(/\n|;|&&|\|\||\||&/).map((s) => s.trim()).filter(Boolean);
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
  /(?:^|[\s;&|(`/])(?:python[0-9.]*|pypy[0-9.]*|node|nodejs|deno|bun|perl|ruby|irb|php|lua|luajit|Rscript|osascript|awk|gawk|mawk|nawk|tclsh)(?=[\s;&|)<]|$)/;

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
  return f.startsWith('/') && STDIN_FILE.test(posix.normalize(f));
}
// No-argument flags; -n is a syntax check that runs nothing (never with -i).
const NO_ARG_FLAG = /^-[elxuvn]+$/;
// A program this gate already checked, replaced by `sh -c :`.
const CHECKED = /^sh -c :(?:\s|$)/;
const baseName = (t: string): string => t.replace(/^.*\//, '');

/** The segment's words from its command word on, quotes removed. */
function commandWords(part: string): string[] {
  const toks = part.replace(/['"\\]/g, '').split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < toks.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(toks[i])) i += 1;
  if (i < toks.length && PREFIX_WORDS.has(baseName(toks[i]))) {
    const j = toks.findIndex((t, k) => k > i && RUNNERS.has(baseName(t)));
    return j < 0 ? toks.slice(i) : toks.slice(j);
  }
  return toks.slice(i);
}

/** A word that runs a command or a script: a shell, interpreter, runner or prefix. */
function isRunnerWord(t: string): boolean {
  const b = baseName(t);
  return SHELLS.has(b) || RUNNERS.has(b) || PREFIX_WORDS.has(b) || STRING_RUNNERS.has(b) || b === 'git' || INTERPRETER.test(` ${b} `);
}

function runsUnseenScript(part: string): string | null {
  const w = commandWords(part);
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
    return w.slice(1).some(isRunnerWord) ? 'xargs into a shell, an interpreter or a runner' : null;
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
function checkShellPrograms(command: string): { why: string | null; rest: string } {
  const unreadable = { why: 'an sh -c program the gate cannot read', rest: command };
  let out = '';
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
    if (GUARD_SCRIPT.test(program)) return { why: 'post-review.mjs inside sh -c', rest: command };
    // The words after the program are its arguments: a positional parameter
    // in the program runs them ($@, $*, $1), which this check cannot read.
    const trailing = (command.slice(end).match(/^[^;&|\n]*/)?.[0] ?? '').trim();
    if (trailing && /\$(?:[@*#]|\d|\{[@*#\d])/.test(program)) {
      return { why: 'a positional parameter in an sh -c program with trailing words', rest: command };
    }
    const why = rawWriteReason(program);
    if (why) return { why, rest: command };
    out += `${command.slice(last, start)}sh -c :`;
    last = end;
  }
  return { why: null, rest: out + command.slice(last) };
}

/**
 * Why the command writes to GitHub by any path but the guard script, or null.
 * No quoted text is skipped: `echo "$(gh pr comment ...)"` runs the post, so a
 * harmless `echo "gh pr review"` is denied too (fail closed).
 */
export function rawWriteReason(full: string): string | null {
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
        if (CHECKED.test(commandWords(part).join(' '))) {
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
}

const DEFAULT_DEPS: ReviewPostGateDeps = {
  readOptIn,
  pluginRoot: () => (process.env.CLAUDE_PLUGIN_ROOT ?? '').trim().replace(/\/+$/, ''),
};

const SCRIPT_REL = 'skills/review-pr/scripts/post-review.mjs';

function touchesTranscript(text: string, transcriptPath: string | undefined): boolean {
  if (transcriptPath && text.includes(transcriptPath)) return true;
  return TRANSCRIPT_DIR.test(text);
}
const TRANSCRIPT_DENY =
  'review-pr may not touch a session transcript (.claude/projects): the --post opt-in is read from it. Do not retry another way.';

function deny(ctx: HookContext, input: HookInput, reason: string): HookResult {
  ctx.logPermission('deny', reason, input);
  return outputDeny(reason);
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
    return deny(ctx, input, `review-post-gate failed (${err instanceof Error ? err.message : String(err)}), so it denies. Print the review and stop.`);
  }
}

function gate(input: HookInput, ctx: HookContext, deps: ReviewPostGateDeps): HookResult {
  if (input.tool_name === 'Write' || input.tool_name === 'Edit' || input.tool_name === 'NotebookEdit') {
    const fp = input.tool_input?.file_path;
    if (typeof fp === 'string' && touchesTranscript(fp, input.transcript_path)) return deny(ctx, input, TRANSCRIPT_DENY);
    const root = deps.pluginRoot();
    if (typeof fp === 'string' && (/(?:^|\/)post-review\.mjs$/.test(fp) || (root && fp.startsWith(`${root}/skills/review-pr/`)))) {
      return deny(ctx, input, 'review-pr may not write post-review.mjs or its own skill dir: the post gate trusts that file.');
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
  const command = typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
  if (!command) return outputSilentSuccess();
  if (touchesTranscript(command, input.transcript_path)) return deny(ctx, input, TRANSCRIPT_DENY);

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
