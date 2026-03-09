/**
 * PR Merge Gate Hook
 * Checks PR status before merge commands.
 * Also handles feature docs reminder and multi-instance quality gates
 * (moved from advisory dispatcher — #915, they only fire on merge commands).
 *
 * CC 2.1.9: Injects PR status via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { isAgentTeamsActive } from '../../lib/agent-teams.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    const args = ['pr', 'view'];
    if (prNumber) args.push(`${prNumber}`);
    args.push('--json', 'number,state,mergeable,statusCheckRollup,reviewDecision');
    const result = execFileSync('gh', args, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

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

  // --- Feature docs reminder (moved from issue-docs-requirement — #915) ---
  const isFeature =
    (command.includes('--label') && /feat/i.test(command)) ||
    /feat|feature/.test(command);

  if (isFeature) {
    issues.push(
      'Feature merge — verify docs are updated: README, JSDoc, CHANGELOG, examples'
    );
    logHook('pr-merge-gate', 'Feature docs reminder added');
  }

  // --- Multi-instance quality gate (moved from multi-instance-quality-gate — #915) ---
  if (!isAgentTeamsActive()) {
    const dbPath = join(projectDir, '.claude', 'coordination', '.claude.db');
    if (existsSync(dbPath)) {
      try {
        const registryPath = join(projectDir, '.claude', 'coordination', 'work-registry.json');
        if (existsSync(registryPath)) {
          const data = JSON.parse(readFileSync(registryPath, 'utf8'));
          const gates = data.qualityGates || {};
          const requiredGates = ['tests', 'lint', 'typecheck'];
          const failedGates = requiredGates.filter((g: string) => !gates[g]);
          if (failedGates.length > 0) {
            issues.push(`Quality gates failed: ${failedGates.join(', ')} — run before merging`);
            logHook('pr-merge-gate', `Quality gates: ${failedGates.join(', ')}`);
          }
        }
      } catch {
        // Ignore registry read errors
      }
    }
  }

  if (issues.length > 0) {
    const context = `PR #${status.number} pre-merge check:\n${issues.join('\n')}\n\nResolve these before merging.`;
    logPermissionFeedback('allow', `PR issues: ${issues.join(', ')}`, input);
    logHook('pr-merge-gate', `PR #${status.number} has ${issues.length} issues`);
    return outputAllowWithContext(context);
  }

  // PR looks good
  logPermissionFeedback('allow', `PR #${status.number} ready to merge`, input);
  return outputSilentSuccess();
}
