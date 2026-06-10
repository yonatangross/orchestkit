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
 *   3. session-state `shell_cwd` — the Bash tool's persistent cwd as
 *      recorded by the CwdChanged hook (file read — call lazily!)
 * Relative paths resolve against the project dir. Returns null when the
 * command gives no signal beyond the session project dir.
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
// VALIDATION FUNCTIONS
// =============================================================================

function validateBranchProtection(
  gitCommand: string,
  currentBranch: string,
  resolveEffective: () => string | null,
): HookResult | null {
  if (!isProtectedBranch(currentBranch)) {
    return null;
  }

  // Worktree-awareness (#2363): the session project dir is on a protected
  // branch, but the command may execute elsewhere — `git -C <path>`, a
  // leading `cd <path> &&`, or the shell's persistent cwd recorded by the
  // CwdChanged hook. Judge by the branch where the command actually runs.
  // An unresolvable/unknown branch falls through to the protected verdict
  // (fail closed).
  const effectiveDir = resolveEffective();
  if (effectiveDir) {
    const effectiveBranch = getCurrentBranch(effectiveDir);
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
    const errorMsg = `BLOCKED: Cannot commit or push directly to '${currentBranch}' branch.

Required workflow:
1. git checkout -b issue/<number>-<description>
2. git commit -m "feat(#<number>): Description"
3. git push -u origin issue/<number>-<description>
4. gh pr create --base dev`;

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
  const protectionResult = validateBranchProtection(gitCommand, currentBranch, resolveEffective);
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
