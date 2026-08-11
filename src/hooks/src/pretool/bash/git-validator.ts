/**
 * Unified Git Validator Hook
 * Consolidates: branch-protection, branch-naming, commit-message, atomic-commit
 *
 * Performance: Single execSync call for branch, cached for all validations
 * CC 2.1.9 Enhanced: additionalContext for guidance
 *
 * @version 2.0.0 - Consolidated from 4 separate hooks
 */

import { isAbsolute, join } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputWithContext,
  outputAllowWithContext,
  logPermissionFeedback,
} from '../../lib/common.js';
import { isProtectedBranch, validateBranchName, analyzeStagedChanges, getCurrentBranch } from '../../lib/git.js';
import { NOOP_CTX } from '../../lib/context.js';
import { getStateFilePath, readSessionState, repoSlugFromCwd } from '../../lib/session-state.js';
import { listLinkedWorktrees } from '../../lib/worktree-scan.js';
import { recordDenial } from '../../lib/denial-counter.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const VALID_COMMIT_TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'style', 'perf', 'ci', 'build'];
const STAGED_FILE_WARNING_THRESHOLD = 10;

/**
 * Get the commit scope enforcement mode.
 * Configurable via ORCHESTKIT_COMMIT_SCOPE env var (set in ork.settings.json).
 *
 * Values:
 *   "required"  — commits without scope are blocked: type(scope): desc
 *   "optional"  — scope allowed but not required (default)
 *   "none"      — scope stripped from validation, any type: desc passes
 */
function getCommitScopeMode(): 'required' | 'optional' | 'none' {
  const val = process.env.ORCHESTKIT_COMMIT_SCOPE?.toLowerCase().trim();
  if (val === 'required') return 'required';
  if (val === 'none') return 'none';
  return 'optional';
}

// =============================================================================
// HELPERS
// =============================================================================

function extractCommitMessage(command: string): string | null {
  const quotedMatch = command.match(/-m\s+["']([^"']+)["']/);
  if (quotedMatch) return quotedMatch[1];

  const unquotedMatch = command.match(/-m\s+(\S+)/);
  if (unquotedMatch) return unquotedMatch[1];

  return null;
}

function extractNewBranchName(command: string): string | null {
  const checkoutMatch = command.match(/checkout\s+-b\s+(\S+)/);
  if (checkoutMatch) return checkoutMatch[1];

  const branchMatch = command.match(/git\s+branch\s+(\S+)/);
  if (branchMatch) return branchMatch[1];

  return null;
}

/**
 * Strip CLI proxy prefixes (e.g. `rtk git ...` → `git ...`) so pattern
 * matching works regardless of whether a token-optimizing proxy is active.
 */
function stripProxyPrefix(cmd: string): string {
  return cmd.replace(/^rtk\s+/, '');
}

// =============================================================================
// LEADING-CHAIN PARSING (#2363)
// =============================================================================

/**
 * Matches a segment that IS a git invocation, allowing the common harmless
 * prefixes: `rtk` proxy, `env [-u NAME]...`, and `NAME=value` assignments.
 * Capture group 1 is the `git` token itself (used for offset math).
 */
const GIT_SEGMENT_RE =
  /^(?:rtk\s+)?(?:env(?:\s+-u\s+[A-Za-z_][A-Za-z0-9_]*)*\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+)*(git)(?:\s|$)/;

export interface LocatedGit {
  /** Offset of the `git` token in the original command string. */
  offset: number;
  /** Target of the last leading `cd <path>` before the git segment, if any. */
  cdTarget: string | null;
}

/**
 * Locate a git invocation at the head of a command, looking through a
 * leading chain of SIMPLE quote-free segments (`cd x && git commit`,
 * `pwd && git push`, `env -u TOKEN git push`). This closes the historical
 * under-blocking gap where any compound command skipped validation
 * (#2363) — without parsing quoted strings: the scan stops cold at the
 * first quote/subshell character, so prose like
 * `gh issue create --body "... git commit ..."` is never matched.
 *
 * Returns null when the command does not lead with git through a simple
 * chain (then the validator stays silent, exactly like the old
 * startsWith guard).
 */
export function locateGitSegment(command: string): LocatedGit | null {
  let cdTarget: string | null = null;
  let pos = 0;
  const n = command.length;

  while (pos < n) {
    // Skip whitespace between segments
    while (pos < n && /\s/.test(command[pos])) pos++;
    if (pos >= n) return null;

    // Read one segment: ends at && or ; — but stop trusting the parse at
    // the first quote/backtick/subshell character.
    let end = pos;
    let sawQuote = false;
    while (end < n) {
      const ch = command[end];
      if (ch === '"' || ch === "'" || ch === '`' || ch === '$') {
        sawQuote = true;
        break;
      }
      if (ch === ';' || (ch === '&' && command[end + 1] === '&') || ch === '|') {
        break;
      }
      end++;
    }

    const segment = command.slice(pos, end).trim();

    const gitMatch = GIT_SEGMENT_RE.exec(segment);
    if (gitMatch) {
      // Offset of the `git` token in the ORIGINAL string. The regex is
      // anchored and ends at the git token (+1 ws), so the real token is
      // always the LAST `git` occurrence in the matched prefix — even for
      // pathological prefixes like `FOO=git git push`.
      const offsetInSegment = gitMatch[0].lastIndexOf(gitMatch[1]);
      return { offset: pos + offsetInSegment, cdTarget };
    }

    // A quote appeared before any git segment — the rest is untrusted prose
    // territory (gh bodies, echo strings). Bail out entirely.
    if (sawQuote) return null;

    const cdMatch = segment.match(/^cd\s+([^\s]+)$/);
    if (cdMatch) {
      cdTarget = cdMatch[1];
    } else if (!/^[A-Za-z0-9_./-]+(\s+[^"'`$;|&]*)?$/.test(segment) && segment !== '') {
      // Not a simple command — don't keep scanning past things we can't read.
      return null;
    }

    // Advance past the separator. Pipes end our interest in the chain —
    // a git command on the right of a pipe receives stdin, and commit/push
    // forms that matter don't appear there in practice.
    if (end >= n) return null;
    if (command[end] === ';') pos = end + 1;
    else if (command[end] === '&') pos = end + 2;
    else return null; // '|' or unexpected — stop
  }

  return null;
}

// =============================================================================
// EFFECTIVE-DIRECTORY RESOLUTION (#2363)
// =============================================================================

/**
 * Where will this git command actually run? Resolution order:
 *   1. `git -C <path>`           — explicit, highest trust
 *   2. leading `cd <path> &&`    — explicit in the same command
 *   3. session-state `shell_cwd`, the Bash tool's persistent cwd, as tracked
 *      by posttool/bash/session-heartbeat-publisher (file read, so call lazily!)
 * Relative paths resolve against the project dir. Returns null when the
 * command gives no signal beyond the session project dir.
 *
 * Path 3 used to credit the CwdChanged hook, and was dead for as long as it
 * said so: CC does not fire CwdChanged for a `cd` inside a Bash call, so across
 * 1763 recorded sessions no state file ever gained a shell_cwd (#3411). Paths 1
 * and 2 looked like redundancy when they were the entire mechanism, and a bare
 * `git push` from a worktree was therefore judged against the project dir,
 * denied as "committing to main" while nothing was on main. The tracker in
 * lib/shell-cwd.ts is what makes this path real; do not re-point it at an event
 * without first checking that a shell_cwd actually lands on disk.
 */
export function resolveEffectiveDir(
  gitCommand: string,
  cdTarget: string | null,
  input: HookInput,
  ctx: HookContext,
): string | null {
  const projectDir = input.project_dir || ctx.projectDir || '';
  const absolutize = (p: string): string =>
    isAbsolute(p) ? p : join(projectDir, p);

  const dashC = gitCommand.match(/^git\s+-C\s+([^\s]+)/);
  if (dashC) return absolutize(dashC[1]);

  if (cdTarget) return absolutize(cdTarget);

  // Session-state shell_cwd — one small JSON read, ONLY reached on the
  // would-block/advisory path (project dir on a protected branch), so the
  // common feature-branch hot path stays I/O-free per the perf budget.
  const sessionId = input.session_id;
  if (sessionId && projectDir) {
    const statePath = getStateFilePath(repoSlugFromCwd(projectDir), sessionId);
    const state = readSessionState(statePath);
    if (state?.shell_cwd && state.shell_cwd !== projectDir) {
      return state.shell_cwd;
    }
  }

  return null;
}

// =============================================================================
// BRANCH-SWITCH-IN-COMMAND RESOLUTION (TOCTOU, 2026-08-02)
// =============================================================================

/**
 * The branch the command will actually be on when it commits/pushes.
 *
 * `validateBranchProtection` used to judge only the branch at PreToolUse
 * time, but a compound command may SWITCH branches before it commits:
 *   git checkout -b feat/x -q && git commit ... && git push
 * fired from main is the branch-based workflow working exactly as this
 * hook's own error message prescribes — yet the current-branch check
 * denied it (two live false positives on 2026-08-02, same day, same
 * class as the worktree gap #2363 but on the branch axis).
 *
 * Returns the target of the LAST `git checkout <b>` / `git checkout -b <b>`
 * / `git switch [-c] <b>` that appears BEFORE the first `git commit`/`git
 * push`, or null when the command performs no branch switch. File
 * restores are not switches: `git checkout -- <paths>` (target starts
 * with `-`) and `git checkout <ref> -- <paths>` (target followed by
 * ` -- `) are both ignored. A switch TO a protected branch is returned
 * as-is so `git checkout main && git push` still blocks.
 */
export function extractPreCommitSwitchTarget(command: string): string | null {
  const firstMutation = command.search(/\bgit\s+(commit|push)\b/);
  const head = firstMutation === -1 ? command : command.slice(0, firstMutation);

  let last: string | null = null;
  const re = /\bgit\s+(?:checkout|switch)\s+(?:(?:-b|-B|-c)\s+)?([^\s;&|]+)/g;
  for (const m of head.matchAll(re)) {
    const target = m[1];
    // Flags (`--`, `-q`, `--detach`, ...) are not branch names.
    if (target.startsWith('-')) continue;
    // `git checkout <ref> -- <paths>` restores paths; not a switch.
    if (/^\s*--(\s|$)/.test(head.slice(m.index + m[0].length))) continue;
    last = target;
  }
  return last;
}

// =============================================================================
// DENIAL GUIDANCE (#3422)
// =============================================================================

/**
 * Rewrite the command to run explicitly in `worktreePath`.
 *
 * Returns null when the command already carries its own `-C`: the caller was
 * explicit about where git runs, so the branch we are blocking on really is
 * the branch there. Suggesting a different `-C` would be overriding a stated
 * intent, not fixing a resolution gap.
 */
export function buildWorktreeRewrite(gitCommand: string, worktreePath: string): string | null {
  if (/^git\s+-C(\s|=)/.test(gitCommand)) return null;
  const m = gitCommand.match(/^git\s+([\s\S]+)$/);
  if (!m) return null;
  return `git -C ${worktreePath} ${m[1].trim()}`;
}

/** Escalation banner for a command this session has already been denied for. */
function repetitionBanner(count: number, projectDir: string): string {
  const lead =
    count === 2 ? 'SECOND IDENTICAL DENIAL' : `IDENTICAL DENIAL #${count}`;
  return `${lead} — do not re-send this command. It has been denied ${count} times in this session, byte for byte, and re-sending the same bytes will be denied again.

Change the command's SHAPE (see the rewrite below), or run a read-only diagnostic first:
  git -C ${projectDir} branch --show-current`;
}

export interface DenialContext {
  /** The git segment being blocked, starting at the `git` token. */
  gitCommand: string;
  /** Exact bytes of the tool call, for repetition keying. */
  rawCommand: string;
  /** Branch the guard judged, i.e. the one it is protecting. */
  currentBranch: string;
  /** Session project dir — the primary tree. */
  projectDir: string;
  /** Session id; empty disables repetition tracking. */
  sessionId: string;
  /** Directory the command was resolved to run in, when any was resolvable. */
  effectiveDir: string | null;
  /** Branch found at `effectiveDir`, when it was readable. */
  effectiveBranch: string | null;
}

/**
 * The full text of a protected-branch denial.
 *
 * Two enrichments over the bare block (#3422), both additive and both
 * fail-open — any failure below degrades to the original workflow text:
 *
 *  (a) When the repo has linked worktrees on non-protected branches, the
 *      mismatch is worktree-shaped: the guard resolves the effective
 *      directory from the COMMAND STRING only, so a session whose shell is
 *      already inside a worktree looks identical to one sitting on the trunk.
 *      Telling that operator to "create a feature branch" is wrong advice —
 *      they have one. We print the exact `git -C <abs path>` rewrite instead.
 *
 *  (b) When this exact command has been denied before, the repetition itself
 *      is the finding and leads the message.
 */
export function buildProtectedBranchDenial(ctx: DenialContext): string {
  const sections: string[] = [];

  const count = recordDenial(ctx.rawCommand, repoSlugFromCwd(ctx.projectDir), ctx.sessionId);
  if (count >= 2) {
    sections.push(repetitionBanner(count, ctx.projectDir));
  }

  sections.push(`BLOCKED: Cannot commit or push directly to '${ctx.currentBranch}' branch.`);

  // A resolved directory that produced no usable branch is its own diagnosis:
  // the path in the command (or the recorded shell cwd) does not name a repo.
  // `~` is the usual culprit — it is not expanded, so it absolutizes against
  // the project dir into a path that does not exist.
  if (ctx.effectiveDir && (!ctx.effectiveBranch || ctx.effectiveBranch === 'unknown')) {
    sections.push(
      `Note: the command resolved to '${ctx.effectiveDir}', but no git branch is readable there, so the guard fell back to the session dir. Absolute paths only — a leading '~' is not expanded.`,
    );
  }

  // Enrichment only: a failure here must cost the rewrite, never the block.
  let candidates: Array<{ path: string; branch: string }> = [];
  try {
    candidates = listLinkedWorktrees(ctx.projectDir).filter(
      (w) => w.branch && !isProtectedBranch(w.branch),
    );
  } catch {
    candidates = []; // silent: fail-open — fall back to the standard workflow text
  }
  const rewrite =
    candidates.length > 0 ? buildWorktreeRewrite(ctx.gitCommand, candidates[0].path) : null;

  if (rewrite) {
    sections.push(`This guard reads the COMMAND STRING, not the shell's working directory — the hook runs in its own process, so a \`cd\` you ran earlier is invisible to it. If you are working in a linked worktree, name it per-command.

Run this instead (copyable as-is):
  ${rewrite}`);

    const others = candidates.slice(1, 4);
    if (others.length > 0) {
      const lines = others.map((w) => `  ${w.path}  [${w.branch}]`).join('\n');
      sections.push(`Other worktrees on feature branches:\n${lines}`);
    }
  } else {
    // No --base: gh already defaults to the repo's own base branch, so naming
    // one here can only ever be wrong somewhere (#3411).
    sections.push(`Required workflow:
1. git checkout -b issue/<number>-<description>
2. git commit -m "feat(#<number>): Description"
3. git push -u origin issue/<number>-<description>
4. gh pr create`);
  }

  return sections.join('\n\n');
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateBranchProtection(
  gitCommand: string,
  currentBranch: string,
  resolveEffective: () => string | null,
  denial?: Omit<DenialContext, 'gitCommand' | 'currentBranch' | 'effectiveDir' | 'effectiveBranch'>,
): HookResult | null {
  if (!isProtectedBranch(currentBranch)) {
    return null;
  }

  // Branch-switch awareness (TOCTOU): if the command itself moves to a
  // non-protected branch before the first commit/push, judge THAT branch.
  // A switch to another protected branch falls through to the block below.
  const switchTarget = extractPreCommitSwitchTarget(gitCommand);
  if (switchTarget && !isProtectedBranch(switchTarget)) {
    logPermissionFeedback(
      'allow',
      `Branch-switch-aware: command checks out '${switchTarget}' before committing (session on '${currentBranch}')`,
    );
    return outputAllowWithContext(
      `Command switches to branch '${switchTarget}' before commit/push — session dir is on '${currentBranch}', not blocking.`,
    );
  }

  // Worktree-awareness (#2363): the session project dir is on a protected
  // branch, but the command may execute elsewhere — `git -C <path>`, a
  // leading `cd <path> &&`, or the shell's persistent cwd as tracked across
  // commands (#3411). Judge by the branch where the command actually runs.
  // An unresolvable/unknown branch falls through to the protected verdict
  // (fail closed).
  const effectiveDir = resolveEffective();
  let effectiveBranch: string | null = null;
  if (effectiveDir) {
    effectiveBranch = getCurrentBranch(effectiveDir);
    if (
      effectiveBranch &&
      effectiveBranch !== 'unknown' &&
      !isProtectedBranch(effectiveBranch)
    ) {
      logPermissionFeedback(
        'allow',
        `Worktree-aware: '${effectiveBranch}' at ${effectiveDir} (session dir on '${currentBranch}')`,
      );
      return outputAllowWithContext(
        `git runs on branch '${effectiveBranch}' (${effectiveDir}) — session dir is on '${currentBranch}', not blocking.`,
      );
    }
  }

  if (/git\s+(commit|push)/.test(gitCommand)) {
    const errorMsg = buildProtectedBranchDenial({
      gitCommand,
      rawCommand: denial?.rawCommand ?? gitCommand,
      currentBranch,
      projectDir: denial?.projectDir ?? '',
      sessionId: denial?.sessionId ?? '',
      effectiveDir,
      effectiveBranch,
    });

    logPermissionFeedback('deny', `Blocked on protected branch: ${currentBranch}`);
    return outputDeny(errorMsg);
  }

  return outputWithContext(`On protected branch '${currentBranch}'. Create feature branch for changes.`);
}

function validateBranchNaming(command: string): HookResult | null {
  if (!/git\s+(checkout\s+-b|branch\s+)/.test(command)) {
    return null;
  }

  const branchName = extractNewBranchName(command);
  if (!branchName) return null;

  const validationError = validateBranchName(branchName);
  if (validationError) {
    const context = `Branch naming: ${validationError}

Recommended: issue/123-description, feature/xyz, fix/bug-name`;
    logPermissionFeedback('allow', `Branch naming guidance: ${branchName}`);
    return outputAllowWithContext(context);
  }

  return null;
}

function validateCommitMessage(command: string): HookResult | null {
  if (!/^git\s+commit/.test(command)) {
    return null;
  }

  if (/<<['"]?EOF/.test(command)) {
    return outputAllowWithContext(`Heredoc commit. Use: type(#issue): description
Types: ${VALID_COMMIT_TYPES.join(', ')}
End with: Co-Authored-By: Claude <noreply@anthropic.com>`);
  }

  const commitMsg = extractCommitMessage(command);
  if (!commitMsg) {
    return outputAllowWithContext(`Interactive commit. Use: type(#issue): description`);
  }

  const typesPattern = VALID_COMMIT_TYPES.join('|');
  const scopeMode = getCommitScopeMode();

  // Build patterns based on scope enforcement mode
  const conventionalPattern = new RegExp(`^(${typesPattern})(\\(#?[0-9]+\\)|(\\([a-z][a-z0-9-]*\\)))?: .+`);
  const simplePattern = new RegExp(`^(${typesPattern}): .+`);
  const requiredScopePattern = new RegExp(`^(${typesPattern})(\\(#?[0-9]+\\)|(\\([a-z][a-z0-9-]*\\))): .+`);

  let isValid: boolean;
  if (scopeMode === 'required') {
    isValid = requiredScopePattern.test(commitMsg);
  } else {
    isValid = conventionalPattern.test(commitMsg) || simplePattern.test(commitMsg);
  }

  if (isValid) {
    const titleLen = commitMsg.split('\n')[0].length;
    if (titleLen > 72) {
      return outputAllowWithContext(`Commit title is ${titleLen} chars (max 72 recommended)`);
    }
    return null;
  }

  const scopeHint = scopeMode === 'required'
    ? 'type(scope): description  ← scope REQUIRED (ORCHESTKIT_COMMIT_SCOPE=required)'
    : 'type(#issue): description  or  type: description';

  const errorMsg = `INVALID COMMIT FORMAT: "${commitMsg}"

Required: ${scopeHint}
Types: ${VALID_COMMIT_TYPES.join(', ')}
Example: feat(#123): Add user authentication`;

  logPermissionFeedback('deny', `Invalid commit: ${commitMsg}`);
  return outputDeny(errorMsg);
}

function validateAtomicCommit(command: string, projectDir?: string): HookResult | null {
  if (!/^git\s+commit/.test(command)) {
    return null;
  }

  const analysis = analyzeStagedChanges(projectDir);
  const warnings: string[] = [];

  // Check 1: File count threshold
  if (analysis.files.length > STAGED_FILE_WARNING_THRESHOLD) {
    warnings.push(`Large commit: ${analysis.files.length} staged files.`);
  }

  // Check 2: Mixed concerns — source + docs + config in one commit
  const concernCount = [analysis.hasSource, analysis.hasDocs, analysis.hasConfig].filter(Boolean).length;
  if (concernCount > 1 && !analysis.hasTests) {
    // Tests with source is fine, but source + docs + config is suspicious
    const concerns = [];
    if (analysis.hasSource) concerns.push('source code');
    if (analysis.hasDocs) concerns.push('documentation');
    if (analysis.hasConfig) concerns.push('configuration');
    warnings.push(`Mixed concerns: ${concerns.join(' + ')}. Consider separate commits for each.`);
  }

  // Check 3: Directory spread — changes in many unrelated top-level dirs
  const topLevelDirs = new Set(analysis.files.map((f) => f.split('/')[0]).filter((d) => d && d !== '.'));
  const UNRELATED_DIR_THRESHOLD = 4;
  if (topLevelDirs.size >= UNRELATED_DIR_THRESHOLD) {
    warnings.push(
      `Changes span ${topLevelDirs.size} top-level directories (${[...topLevelDirs].slice(0, 5).join(', ')}). Verify all changes are related.`
    );
  }

  // Check 4: Detect likely commit type mixing from file patterns
  const commitMsg = extractCommitMessage(command);
  if (commitMsg) {
    const declaredType = commitMsg.match(/^(feat|fix|refactor|docs|test|chore|style|perf|ci|build)/)?.[1];
    if (declaredType === 'feat' && analysis.hasConfig && !analysis.hasSource) {
      warnings.push(`Commit type is "feat" but only config files are staged. Use "chore" instead?`);
    }
    if (declaredType === 'docs' && analysis.hasSource) {
      warnings.push(`Commit type is "docs" but source files are staged. Split docs from code changes.`);
    }
    if (declaredType === 'test' && analysis.hasSource && !analysis.hasTests) {
      warnings.push(`Commit type is "test" but no test files found in staged changes.`);
    }
  }

  if (warnings.length > 0) {
    const context = `Atomic commit check:\n${warnings.map((w) => `- ${w}`).join('\n')}\n\nTip: Use \`git add -p\` to stage changes interactively. See commit/rules/atomic-commit.md for guidelines.`;
    return outputAllowWithContext(context);
  }

  return null;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function gitValidator(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const command = stripProxyPrefix(input.tool_input.command || '');

  // Locate the git invocation — at position 0 OR after a leading chain of
  // simple quote-free segments (`cd x && git commit`, `env -u T git push`).
  // The old `startsWith('git')` guard let any compound command skip
  // validation entirely (#2363 under-blocking).
  const located = locateGitSegment(command);
  if (!located) {
    return outputSilentSuccess();
  }
  const gitCommand = command.slice(located.offset);

  const currentBranch = ctx.branch;

  ctx.log('git-validator', `Validating: ${gitCommand.slice(0, 50)}...`);

  // Lazy effective-dir resolution — only invoked on the protected-branch
  // path so the common (feature-branch) hot path does zero extra work.
  const resolveEffective = (): string | null =>
    resolveEffectiveDir(gitCommand, located.cdTarget, input, ctx);

  // 1. Branch protection (can block)
  // The RAW command (not the git segment) keys the repetition counter: a
  // re-send is byte-identical at the tool-call level, which is the level the
  // operator actually retries at (#3422).
  const protectionResult = validateBranchProtection(gitCommand, currentBranch, resolveEffective, {
    rawCommand: input.tool_input.command || '',
    projectDir: input.project_dir || ctx.projectDir || '',
    sessionId: input.session_id || '',
  });
  if (protectionResult?.continue === false) {
    return protectionResult;
  }

  // 2. Commit message validation (can block)
  const commitMsgResult = validateCommitMessage(gitCommand);
  if (commitMsgResult?.continue === false) {
    return commitMsgResult;
  }

  // 3. Branch naming (advisory)
  const branchNameResult = validateBranchNaming(gitCommand);

  // 4. Atomic commit (advisory)
  const atomicResult = validateAtomicCommit(gitCommand, input.project_dir);

  // Combine advisory contexts
  const contexts: string[] = [];

  if (protectionResult?.hookSpecificOutput?.additionalContext) {
    contexts.push(protectionResult.hookSpecificOutput.additionalContext as string);
  }
  if (commitMsgResult?.hookSpecificOutput?.additionalContext) {
    contexts.push(commitMsgResult.hookSpecificOutput.additionalContext as string);
  }
  if (branchNameResult?.hookSpecificOutput?.additionalContext) {
    contexts.push(branchNameResult.hookSpecificOutput.additionalContext as string);
  }
  if (atomicResult?.hookSpecificOutput?.additionalContext) {
    contexts.push(atomicResult.hookSpecificOutput.additionalContext as string);
  }

  if (contexts.length > 0) {
    return outputWithContext(contexts.join('\n\n'));
  }

  return outputSilentSuccess();
}
