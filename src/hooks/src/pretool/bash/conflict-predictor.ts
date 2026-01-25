/**
 * Conflict Predictor Hook
 * Predicts potential merge conflicts before git operations
 * CC 2.1.9: Injects warnings via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
  getProjectDir,
} from '../../lib/common.js';
import { execSync } from 'node:child_process';

/**
 * Get files that might conflict on merge/rebase
 */
function getPotentialConflicts(projectDir: string, targetBranch: string): string[] {
  try {
    // Get files changed in current branch since diverging from target
    const result = execSync(
      `git diff --name-only ${targetBranch}...HEAD 2>/dev/null || echo ""`,
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    const changedFiles = result.trim().split('\n').filter(Boolean);

    // Check which of these files have also been modified in target branch
    const conflicts: string[] = [];
    for (const file of changedFiles.slice(0, 20)) {
      // Limit to first 20 files
      try {
        const targetModified = execSync(
          `git log -1 --pretty=format:"%h" ${targetBranch} -- "${file}" 2>/dev/null || echo ""`,
          {
            cwd: projectDir,
            encoding: 'utf8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        if (targetModified.trim()) {
          conflicts.push(file);
        }
      } catch {
        // Ignore individual file check errors
      }
    }

    return conflicts;
  } catch {
    return [];
  }
}

/**
 * Predict conflicts before merge/rebase operations
 */
export function conflictPredictor(input: HookInput): HookResult {
  const command = input.tool_input.command || '';
  const projectDir = getProjectDir();

  // Only process git merge or rebase commands
  if (!/git\s+(merge|rebase|pull)/.test(command)) {
    return outputSilentSuccess();
  }

  // Extract target branch
  let targetBranch: string | null = null;

  // git merge <branch>, git rebase <branch>
  const branchMatch = command.match(/git\s+(merge|rebase)\s+(\S+)/);
  if (branchMatch) {
    targetBranch = branchMatch[2];
  }

  // git pull (uses remote tracking branch)
  if (command.includes('git pull')) {
    targetBranch = 'origin/dev'; // Assume dev as base
  }

  if (!targetBranch) {
    return outputSilentSuccess();
  }

  // Check for potential conflicts
  const conflicts = getPotentialConflicts(projectDir, targetBranch);

  if (conflicts.length > 0) {
    const context = `Potential conflicts detected: ${conflicts.length} file(s)
Files: ${conflicts.slice(0, 5).join(', ')}${conflicts.length > 5 ? '...' : ''}

Consider:
1. Review changes in these files before merging
2. Run: git diff ${targetBranch}...HEAD -- <file>
3. Prepare conflict resolution strategy`;

    logPermissionFeedback('allow', `Conflict prediction: ${conflicts.length} files`, input);
    logHook('conflict-predictor', `Potential conflicts: ${conflicts.join(', ')}`);
    return outputAllowWithContext(context);
  }

  logPermissionFeedback('allow', 'No conflicts predicted', input);
  return outputSilentSuccess();
}
