/**
 * Session Tracking Hook
 * Issue #245: Multi-User Intelligent Decision Capture System
 * Phase 5: Session Lifecycle Tracking
 *
 * Tracks session start event with context (project, branch, time).
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook, getProjectDir } from '../lib/common.js';
import { trackSessionStart } from '../lib/session-tracker.js';
import { execSync } from 'node:child_process';

/**
 * Get current git branch name
 */
function getGitBranch(projectDir: string): string | undefined {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Track session start event with context
 */
export function sessionTracking(input: HookInput): HookResult {
  try {
    const projectDir = input.project_dir || getProjectDir();
    const gitBranch = getGitBranch(projectDir);

    trackSessionStart({
      project_dir: projectDir,
      git_branch: gitBranch,
    });

    logHook('session-tracking', `Tracked session start: branch=${gitBranch || 'unknown'}`, 'debug');
    return outputSilentSuccess();
  } catch (error) {
    logHook('session-tracking', `Error: ${error}`, 'warn');
    return outputSilentSuccess();
  }
}
