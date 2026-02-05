/**
 * PR Status Enricher - SessionStart Hook
 * CC 2.1.20: Detects open PRs on current branch and sets env vars
 *
 * Runs at session start to provide PR context. Sets:
 * - ORCHESTKIT_PR_URL
 * - ORCHESTKIT_PR_STATE
 */

import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, getCachedBranch, outputSilentSuccess } from '../lib/common.js';

// Branches to skip PR detection
const SKIP_BRANCHES = new Set(['main', 'master', 'dev', 'develop']);

/**
 * PR status enricher hook
 */
export function prStatusEnricher(input: HookInput): HookResult {
  logHook('pr-status-enricher', 'Checking for open PR on current branch');

  const projectDir = input.project_dir || getProjectDir();

  // Get current branch
  let branch: string;
  try {
    branch = getCachedBranch(projectDir);
  } catch {
    logHook('pr-status-enricher', 'Could not determine branch, skipping');
    return outputSilentSuccess();
  }

  if (!branch || SKIP_BRANCHES.has(branch)) {
    logHook('pr-status-enricher', `Branch "${branch}" skipped for PR detection`);
    return outputSilentSuccess();
  }

  // Check for open PR using gh CLI
  try {
    const prJson = execSync(
      'gh pr view --json state,reviewDecision,url,title,isDraft',
      { cwd: projectDir, timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    const pr = JSON.parse(prJson);
    if (!pr.url) {
      logHook('pr-status-enricher', 'No PR found for current branch');
      return outputSilentSuccess();
    }

    // Set env vars for downstream hooks
    process.env.ORCHESTKIT_PR_URL = pr.url;
    process.env.ORCHESTKIT_PR_STATE = pr.state;

    // Get unresolved comment count
    let unresolvedCount = 0;
    try {
      const threadsJson = execSync(
        'gh pr view --json reviewThreads',
        { cwd: projectDir, timeout: 10000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
      const threads = JSON.parse(threadsJson);
      unresolvedCount = (threads.reviewThreads || []).filter(
        (t: { isResolved: boolean }) => !t.isResolved
      ).length;
    } catch {
      // Non-critical, ignore
    }

    const draftLabel = pr.isDraft ? ' (DRAFT)' : '';
    const reviewLabel = pr.reviewDecision ? ` | Review: ${pr.reviewDecision}` : '';
    const unresolvedLabel = unresolvedCount > 0 ? ` | ${unresolvedCount} unresolved` : '';

    logHook('pr-status-enricher', `PR: ${pr.title}${draftLabel} [${pr.state}${reviewLabel}${unresolvedLabel}]`);
    logHook('pr-status-enricher', `URL: ${pr.url}`);
  } catch {
    logHook('pr-status-enricher', 'No PR found or gh CLI unavailable');
  }

  // Note: SessionStart hooks don't support hookSpecificOutput.additionalContext (line 90 of session-context-loader.ts)
  return outputSilentSuccess();
}
