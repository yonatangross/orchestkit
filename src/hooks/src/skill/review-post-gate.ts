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
 *      no graphql at all. Any curl, wget or httpie/xh call to a GitHub host is
 *      denied. Every other gh verb is denied while the skill runs.
 *   2. The one write path is scripts/post-review.mjs, and only when:
 *      - the USER typed --post on the /ork:review-pr line that sits on this
 *        tool call's parentUuid chain (lib/review-opt-in.ts);
 *      - the call names, once, exactly the PR the user typed right after the
 *        command (a number, or the same full github.com pull URL); a bare
 *        number also needs the shell at the session project root, because gh
 *        resolves it against the cwd's repo;
 *      - the call runs the plugin's own copy, <plugin root>/skills/review-pr/
 *        scripts/post-review.mjs, never a copy written elsewhere;
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

const HOOK = 'review-post-gate';
const SKILL_NAMES = ['/ork:review-pr'] as const;

const GUARD_SCRIPT = /\bpost-review\.mjs\b/;
// The one form that runs the script: `node <path>/post-review.mjs ...`.
const GUARD_CALL = /^node\s+\S*\/post-review\.mjs(?:\s|$)/;
// A segment that only reads a file or history (cat the script, grep for
// "pr review", git log --grep, git grep): never a guard call, never a write.
// Only verbs with no flag that runs a command: no less/more (+!cmd); git grep
// counts only without -O (EXEC_FLAG).
// sed counts only as one whole `sed -n 'N,Mp' <file>` (GNU sed's e runs a shell).
const READ_VERB =
  /^(?:cat|head|tail|wc|nl|ls|stat|file|diff|grep|egrep|fgrep|rg|test|git\s+(?:log|show|diff|blame|status|ls-files|cat-file|grep))(?:\s|$)/;
const READ_SED = /^sed\s+-n\s+(['"]?)\d+(?:,\d+)?p\1\s+[^\s;|&<>]+$/;
// Flags that make a read verb run a command: git grep -O/--open-files-in-pager,
// rg --pre/--pre-glob, git --ext-diff/--textconv, and --output (writes a file).
const EXEC_FLAG = /(?:^|\s)(?:-O\S*|--open-files-in-pager\S*|--pre(?:-glob)?(?:=|\s|$)|--ext-diff\b|--textconv\b|--output(?:=|\s|$))/;
const READ_FAMILY = /^(?:git|rg|grep|egrep|fgrep|sed|less|more)(?:\s|$)/;

function isReadOnly(segment: string): boolean {
  if (READ_SED.test(segment)) return true;
  return READ_VERB.test(segment) && !EXEC_FLAG.test(segment.replace(/['"\\]/g, ''));
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
};
const GH_READ_ANY_VERB = new Set(['search', 'help', '--version', 'version']);

// Any field or input flag, also glued to its value (-fbody=x, -Fq=@f, --input=f).
const GITHUB_HOST = /\b(?:api\.github\.com|uploads\.github\.com|github\.com)\b/i;

/**
 * Why `gh api` with these args writes, or null. Reads token by token, so a
 * short-flag cluster counts too (-iX POST, -iXPATCH, -fbody=x).
 */
function ghApiWrite(rest: string): string | null {
  const toks = rest.split(/\s+/).filter(Boolean);
  // graphql as the endpoint word only: a path like repos/o/r/contents/src/graphql/x is a read.
  if (toks.some((t) => /^\/?graphql(?:[/?#]|$)/i.test(t.replace(/^['"]|['"]$/g, '')))) return 'gh api graphql';
  for (let i = 0; i < toks.length; i += 1) {
    const t = toks[i].replace(/^['"]|['"]$/g, '');
    if (/^--(?:field|raw-field|input)(?:=|$)/.test(t)) return 'gh api with a field or input flag';
    const long = t.match(/^--method(?:=(.*))?$/);
    if (long) {
      const v = (long[1] ?? toks[i + 1] ?? '').replace(/^['"]|['"]$/g, '');
      if (v.toUpperCase() !== 'GET') return `gh api --method ${v || '?'}`;
      continue;
    }
    if (/^-[A-Za-z]+/.test(t) && !t.startsWith('--')) {
      const cluster = t.slice(1);
      if (/[fF]/.test(cluster.split('X')[0])) return 'gh api with a field or input flag';
      const x = cluster.indexOf('X');
      if (x >= 0) {
        const v = (cluster.slice(x + 1) || toks[i + 1] || '').replace(/^['"]|['"]$/g, '');
        if (v.toUpperCase() !== 'GET') return `gh api -X ${v || '?'}`;
      }
    }
  }
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

/**
 * Why the command writes to GitHub by any path but the guard script, or null.
 * No quoted text is skipped: `echo "$(gh pr comment ...)"` runs the post, so a
 * harmless `echo "gh pr review"` is denied too (fail closed).
 */
export function rawWriteReason(command: string): string | null {
  for (const seg of segments(command)) {
    // Command substitution and subshells: scan their insides as segments too.
    const inner = [seg, ...[...seg.matchAll(/\$\(([^()]*)\)|`([^`]*)`|\(([^()]*)\)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? '')];
    for (const s of inner) {
      for (const part of segments(s)) {
        // A read verb with a flag that runs a command is not a read.
        // The shell removes quotes first, so "--pre" and '-O...' are the flags.
        if (READ_FAMILY.test(part) && EXEC_FLAG.test(part.replace(/['"\\]/g, ''))) return 'a read verb with a flag that runs a command';
        // A search or a history read names write verbs without running them.
        if (isReadOnly(part)) continue;
        const why = ghWrite(part) ?? verbWrite(part) ?? httpWrite(part);
        if (why) return why;
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
}

const DEFAULT_DEPS: ReviewPostGateDeps = { readOptIn };

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
  if (input.tool_name === 'Write' || input.tool_name === 'Edit' || input.tool_name === 'NotebookEdit') {
    const fp = input.tool_input?.file_path;
    if (typeof fp === 'string' && touchesTranscript(fp, input.transcript_path)) return deny(ctx, input, TRANSCRIPT_DENY);
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
    // Named but not run as `node <path>/post-review.mjs`: a read is fine,
    // any other form (env node, bash -c, running the file) is denied.
    if (segments(command).every((seg) => !GUARD_SCRIPT.test(seg) || isReadOnly(seg))) return outputSilentSuccess();
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
  const root = ctx.pluginRoot.replace(/\/+$/, '');
  if (!root || path !== `${root}/skills/review-pr/scripts/post-review.mjs`) {
    return deny(ctx, input, `Run the plugin's own post-review.mjs (${root || 'plugin root unknown'}/skills/review-pr/scripts/post-review.mjs), not a copy.`);
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
