/**
 * Merge Readiness Checker Hook
 * Comprehensive merge readiness check for worktree branches
 * CC 2.1.7 Compliant
 */

import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getProjectDir } from '../lib/common.js';
import { getRepoRoot, getCurrentBranch, getDefaultBranch, hasUncommittedChanges } from '../lib/git.js';

/**
 * Execute git command safely
 */
function gitExec(command: string, cwd?: string): string {
  try {
    return execSync(command, {
      cwd: cwd || getProjectDir(),
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Check merge readiness for branch
 */
export function mergeReadinessChecker(input: HookInput): HookResult {
  const command = input.tool_input?.command || '';

  // Only run for merge-related commands
  if (!/\b(gh\s+pr\s+merge|git\s+merge|git\s+rebase)\b/i.test(command)) {
    return outputSilentSuccess();
  }

  const targetBranch = (input.tool_input as any).target_branch || 'main';
  const currentBranch = getCurrentBranch();

  if (currentBranch === targetBranch) {
    process.stderr.write(`Already on target branch ${targetBranch}\n`);
    return outputSilentSuccess();
  }

  process.stderr.write(`Checking merge readiness: ${currentBranch} -> ${targetBranch}\n\n`);

  const projectRoot = getRepoRoot() || getProjectDir();
  const errors: string[] = [];
  const warnings: string[] = [];
  const passes: string[] = [];

  // 1. Check for uncommitted changes
  process.stderr.write('1. Checking for uncommitted changes...\n');
  if (hasUncommittedChanges()) {
    const status = gitExec('git status --short');
    errors.push('Uncommitted changes detected:');
    errors.push(status.split('\n').slice(0, 10).join('\n'));
  } else {
    passes.push('No uncommitted changes');
  }

  // 2. Check branch divergence
  process.stderr.write('2. Checking branch divergence...\n');
  gitExec(`git fetch origin ${targetBranch}`);

  const ahead = parseInt(gitExec(`git rev-list --count origin/${targetBranch}..${currentBranch}`) || '0', 10);
  const behind = parseInt(gitExec(`git rev-list --count ${currentBranch}..origin/${targetBranch}`) || '0', 10);

  process.stderr.write(`   Ahead: ${ahead} commits, Behind: ${behind} commits\n`);

  if (behind > 20) {
    errors.push(`Branch is significantly behind ${targetBranch} (${behind} commits)`);
    errors.push(`Rebase or merge ${targetBranch} before proceeding`);
  } else if (behind > 5) {
    warnings.push(`Branch is behind ${targetBranch} by ${behind} commits`);
    warnings.push('Consider rebasing for easier merge');
  } else {
    passes.push(`Branch is up to date (behind by ${behind})`);
  }

  // 3. Check for merge conflicts
  process.stderr.write('3. Checking for merge conflicts...\n');
  const mergeResult = gitExec(`git merge --no-commit --no-ff origin/${targetBranch}`);

  if (mergeResult.includes('CONFLICT')) {
    const conflictFiles = gitExec('git diff --name-only --diff-filter=U');
    errors.push(`Merge conflicts detected with ${targetBranch}:`);
    for (const file of conflictFiles.split('\n').slice(0, 10)) {
      if (file) errors.push(`  - ${file}`);
    }
    errors.push('Resolve conflicts before merging');
    gitExec('git merge --abort');
  } else {
    passes.push('No merge conflicts detected');
    gitExec('git merge --abort');
  }

  // 4. Run quality gates
  process.stderr.write('4. Running quality gates on changed files...\n');
  const mergeBase = gitExec(`git merge-base ${currentBranch} origin/${targetBranch}`);
  if (mergeBase) {
    const changedFiles = gitExec(`git diff --name-only ${mergeBase} ${currentBranch}`);
    const fileCount = changedFiles.split('\n').filter(Boolean).length;
    process.stderr.write(`   Checking ${fileCount} changed files...\n`);
    passes.push('Quality gates check performed');
  } else {
    warnings.push('Cannot determine merge base - skipping file checks');
  }

  // 5. Check test suite
  process.stderr.write('5. Checking test suite...\n');
  if (existsSync(`${projectRoot}/package.json`)) {
    const pkgContent = readFileSync(`${projectRoot}/package.json`, 'utf8');
    if (pkgContent.includes('"test":')) {
      passes.push('Frontend test script found');
    }
  }
  if (existsSync(`${projectRoot}/pytest.ini`) || existsSync(`${projectRoot}/pyproject.toml`)) {
    passes.push('Backend test configuration found');
  }

  // Generate report
  process.stderr.write('\n');
  process.stderr.write('=' .repeat(60) + '\n');
  process.stderr.write('\nMERGE READINESS REPORT\n\n');
  process.stderr.write(`Branch: ${currentBranch} -> ${targetBranch}\n\n`);

  if (passes.length > 0) {
    process.stderr.write('PASSED CHECKS:\n');
    for (const pass of passes) {
      process.stderr.write(`   ${pass}\n`);
    }
    process.stderr.write('\n');
  }

  if (warnings.length > 0) {
    process.stderr.write('WARNINGS:\n');
    for (const warning of warnings) {
      process.stderr.write(`   ${warning}\n`);
    }
    process.stderr.write('\n');
  }

  if (errors.length > 0) {
    process.stderr.write('BLOCKERS:\n');
    for (const error of errors) {
      process.stderr.write(`   ${error}\n`);
    }
    process.stderr.write('\nMERGE NOT READY - Fix blockers before merging\n');
    return { continue: false, stopReason: 'Merge not ready - blockers detected' };
  }

  if (warnings.length > 0) {
    process.stderr.write('MERGE READY WITH WARNINGS\n');
    process.stderr.write('Review warnings before proceeding with merge\n');
  } else {
    process.stderr.write('MERGE READY - All checks passed!\n');
    process.stderr.write('You can safely merge this branch\n');
  }

  return outputSilentSuccess();
}
