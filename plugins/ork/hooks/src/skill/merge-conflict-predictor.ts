/**
 * Merge Conflict Predictor Hook
 * WARNING: Predict merge conflicts before commit
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputWithContext, getProjectDir } from '../lib/common.js';
import { getRepoRoot, getCurrentBranch, getDefaultBranch } from '../lib/git.js';

interface ConflictInfo {
  worktree: string;
  branch: string;
  status: string;
}

/**
 * Get list of git worktrees
 */
function getWorktrees(): string[] {
  try {
    const output = execSync('git worktree list --porcelain', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return output
      .split('\n')
      .filter((line) => line.startsWith('worktree '))
      .map((line) => line.replace('worktree ', ''));
  } catch {
    return [];
  }
}

/**
 * Get branch name for a worktree
 */
function getWorktreeBranch(worktree: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: worktree,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Check if file is modified in a worktree
 */
function isFileModified(worktree: string, relPath: string): boolean {
  try {
    const status = execSync(`git status --short "${relPath}"`, {
      cwd: worktree,
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return /^.M|^M.|^A/.test(status);
  } catch {
    return false;
  }
}

/**
 * Get commits ahead/behind count
 */
function getBranchDivergence(baseBranch: string, currentBranch: string): { ahead: number; behind: number } {
  try {
    const ahead = parseInt(
      execSync(`git rev-list --count ${baseBranch}..${currentBranch}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim(),
      10
    );
    const behind = parseInt(
      execSync(`git rev-list --count ${currentBranch}..${baseBranch}`, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim(),
      10
    );
    return { ahead: ahead || 0, behind: behind || 0 };
  } catch {
    return { ahead: 0, behind: 0 };
  }
}

/**
 * Predict merge conflicts before commit
 */
export function mergeConflictPredictor(input: HookInput): HookResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || (input as any).tool_result || '';

  if (!filePath || !content) return outputSilentSuccess();

  // Check if we have worktrees
  const worktrees = getWorktrees();
  if (worktrees.length === 0) return outputSilentSuccess();

  const warnings: string[] = [];
  const conflicts: ConflictInfo[] = [];

  const repoRoot = getRepoRoot() || getProjectDir();
  const currentWorktree = repoRoot;
  const relPath = filePath.replace(repoRoot + '/', '').replace(repoRoot, '');

  // Check each worktree for concurrent modifications
  for (const worktree of worktrees) {
    if (worktree === currentWorktree) continue;

    const worktreeFile = `${worktree}/${relPath}`;
    if (!existsSync(worktreeFile)) continue;

    const branch = getWorktreeBranch(worktree);

    // Check if file is modified
    if (isFileModified(worktree, relPath)) {
      conflicts.push({ worktree, branch, status: 'modified' });

      // Get the other content to analyze overlap
      try {
        const otherContent = readFileSync(worktreeFile, 'utf8');

        // Count changed lines (simple heuristic)
        const newLines = content.split('\n');
        const otherLines = otherContent.split('\n');
        const diff = Math.abs(newLines.length - otherLines.length);

        if (diff > 10) {
          warnings.push(`OVERLAP: Significant changes in both branches (~${diff} lines)`);
          warnings.push(`  Branch: ${branch}`);
          warnings.push('  High risk of merge conflict');
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  // Check base branch divergence
  const currentBranch = getCurrentBranch();
  const baseBranch = getDefaultBranch();

  if (currentBranch !== baseBranch) {
    const { ahead, behind } = getBranchDivergence(baseBranch, currentBranch);

    if (behind > 10) {
      warnings.push(`DIVERGENCE: Current branch is ${behind} commits behind ${baseBranch}`);
      warnings.push('  Consider rebasing before continuing development');
      warnings.push('  This reduces merge conflict risk');
    }
  }

  // Report conflicts
  if (conflicts.length > 0) {
    warnings.unshift('MERGE CONFLICT RISK: Concurrent modifications detected');
    warnings.unshift('');
    warnings.unshift(`File: ${filePath}`);

    for (const conflict of conflicts) {
      warnings.push(`  Branch: ${conflict.branch}`);
      warnings.push(`  Status: ${conflict.status}`);
      warnings.push(`  Path: ${conflict.worktree}`);
    }

    warnings.push('');
    warnings.push('Recommendations:');
    warnings.push('  1. Coordinate changes with other instances');
    warnings.push('  2. Consider splitting work to avoid overlapping files');
    warnings.push('  3. Communicate before merging');
  }

  if (warnings.length > 0) {
    const ctx = `Potential merge conflicts detected in ${filePath}. Review warnings on stderr.`;
    // Log warnings to stderr
    process.stderr.write(warnings.join('\n') + '\n');
    return outputWithContext(ctx);
  }

  return outputSilentSuccess();
}
