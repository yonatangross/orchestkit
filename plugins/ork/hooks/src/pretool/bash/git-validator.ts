/**
 * Unified Git Validator Hook
 * Consolidates: branch-protection, branch-naming, commit-message, atomic-commit
 *
 * Performance: Single execSync call for branch, cached for all validations
 * CC 2.1.9 Enhanced: additionalContext for guidance
 *
 * @version 2.0.0 - Consolidated from 4 separate hooks
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputWithContext,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getCachedBranch,
} from '../../lib/common.js';
import { isProtectedBranch, validateBranchName, getGitStatus } from '../../lib/git.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const VALID_COMMIT_TYPES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'style', 'perf', 'ci', 'build'];
const STAGED_FILE_WARNING_THRESHOLD = 10;

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

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

function validateBranchProtection(command: string, currentBranch: string): HookResult | null {
  if (!isProtectedBranch(currentBranch)) {
    return null;
  }

  if (/git\s+(commit|push)/.test(command)) {
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
  const conventionalPattern = new RegExp(`^(${typesPattern})(\\(#?[0-9]+\\)|(\\([a-z-]+\\)))?: .+`);
  const simplePattern = new RegExp(`^(${typesPattern}): .+`);

  if (conventionalPattern.test(commitMsg) || simplePattern.test(commitMsg)) {
    const titleLen = commitMsg.split('\n')[0].length;
    if (titleLen > 72) {
      return outputAllowWithContext(`Commit title is ${titleLen} chars (max 72 recommended)`);
    }
    return null;
  }

  const errorMsg = `INVALID COMMIT FORMAT: "${commitMsg}"

Required: type(#issue): description
Types: ${VALID_COMMIT_TYPES.join(', ')}
Example: feat(#123): Add user authentication`;

  logPermissionFeedback('deny', `Invalid commit: ${commitMsg}`);
  return outputDeny(errorMsg);
}

function validateAtomicCommit(command: string, projectDir?: string): HookResult | null {
  if (!/^git\s+commit/.test(command)) {
    return null;
  }

  const status = getGitStatus(projectDir);
  const stagedCount = status.split('\n').filter((line) => line.trim()).length;

  if (stagedCount > STAGED_FILE_WARNING_THRESHOLD) {
    return outputAllowWithContext(`Large commit: ${stagedCount} files. Consider splitting into smaller commits.`);
  }

  return null;
}

// =============================================================================
// MAIN HOOK
// =============================================================================

export function gitValidator(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  if (!command.startsWith('git')) {
    return outputSilentSuccess();
  }

  const currentBranch = getCachedBranch(input.project_dir);

  logHook('git-validator', `Validating: ${command.slice(0, 50)}...`);

  // 1. Branch protection (can block)
  const protectionResult = validateBranchProtection(command, currentBranch);
  if (protectionResult?.continue === false) {
    return protectionResult;
  }

  // 2. Commit message validation (can block)
  const commitMsgResult = validateCommitMessage(command);
  if (commitMsgResult?.continue === false) {
    return commitMsgResult;
  }

  // 3. Branch naming (advisory)
  const branchNameResult = validateBranchNaming(command);

  // 4. Atomic commit (advisory)
  const atomicResult = validateAtomicCommit(command, input.project_dir);

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
