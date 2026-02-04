/**
 * PR Merge Gate Hook
 * Checks PR status before merge commands
 * CC 2.1.9: Injects PR status via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  outputDeny,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { execSync } from 'node:child_process';

interface PRStatus {
  number: number;
  state: string;
  mergeable: boolean;
  statusCheckRollup: string;
  reviewDecision: string;
}

/**
 * Get PR status from GitHub CLI
 */
function getPRStatus(projectDir: string, prNumber?: number): PRStatus | null {
  try {
    const prArg = prNumber ? `${prNumber}` : '';
    const result = execSync(
      `gh pr view ${prArg} --json number,state,mergeable,statusCheckRollup,reviewDecision 2>/dev/null`,
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    return JSON.parse(result) as PRStatus;
  } catch {
    return null;
  }
}

/**
 * Check PR status before merge
 */
export function prMergeGate(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process gh pr merge commands
  if (!/gh\s+pr\s+merge/.test(command)) {
    return outputSilentSuccess();
  }

  // Extract PR number if specified
  const prMatch = command.match(/gh\s+pr\s+merge\s+(\d+)/);
  const prNumber = prMatch ? parseInt(prMatch[1], 10) : undefined;

  // Get PR status
  const status = getPRStatus(projectDir, prNumber);

  if (!status) {
    const context = `Could not fetch PR status. Ensure:
1. gh CLI is installed and authenticated
2. You're in a git repository
3. PR exists and is accessible`;

    logPermissionFeedback('allow', 'PR status unavailable', input);
    return outputAllowWithContext(context);
  }

  // Check if PR is mergeable
  const issues: string[] = [];

  if (status.state !== 'OPEN') {
    issues.push(`PR state: ${status.state} (expected OPEN)`);
  }

  if (!status.mergeable) {
    issues.push('PR has merge conflicts');
  }

  if (status.statusCheckRollup !== 'SUCCESS' && status.statusCheckRollup !== 'PENDING') {
    issues.push(`Status checks: ${status.statusCheckRollup}`);
  }

  if (status.reviewDecision === 'CHANGES_REQUESTED') {
    issues.push('Changes requested by reviewer');
  }

  if (issues.length > 0) {
    const context = `PR #${status.number} has issues:
${issues.join('\n')}

Resolve these before merging.`;

    logPermissionFeedback('allow', `PR issues: ${issues.join(', ')}`, input);
    logHook('pr-merge-gate', `PR #${status.number} has ${issues.length} issues`);
    return outputAllowWithContext(context);
  }

  // PR looks good
  logPermissionFeedback('allow', `PR #${status.number} ready to merge`, input);
  return outputSilentSuccess();
}
