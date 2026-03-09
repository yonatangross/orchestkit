/**
 * Pre-Commit Quality Runner — Parallel lint/test/typecheck before commit
 *
 * Fires on `git commit` commands. Detects staged file types and runs
 * relevant quality checks in parallel:
 * - TypeScript changed → tsc --noEmit
 * - JS/TS changed → eslint --cache (if available)
 * - Source files changed → npm test --findRelatedTests (if jest)
 *
 * Returns BLOCK if any check fails, with error details.
 *
 * Skip: ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS=true
 *
 * @hook PreToolUse (Bash: git commit*)
 * @since v7.2.0
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../../types.js';
import { outputSilentSuccess, outputBlock, logHook, getProjectDir } from '../../lib/common.js';
import { getStagedSourceFiles } from '../../lib/git.js';

const HOOK_NAME = 'pre-commit-quality-runner';

interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

function isCommitCommand(command: string): boolean {
  return /^git\s+commit(?:\s|$)/.test(command.trim());
}

function hasTypeScriptFiles(files: string[]): boolean {
  return files.some(f => /\.(ts|tsx)$/.test(f));
}

function hasLintableFiles(files: string[]): boolean {
  return files.some(f => /\.(ts|tsx|js|jsx)$/.test(f));
}

function hasSourceFiles(files: string[]): boolean {
  return files.some(f => /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.') && !f.includes('__tests__'));
}

/** Extract error output from exec/execFile errors (Node SpawnSyncReturns) */
function getExecOutput(err: unknown): string {
  const e = err as { stderr?: string; stdout?: string; message?: string };
  return e?.stderr || e?.stdout || (err instanceof Error ? err.message : String(err));
}

/** SEC-001 fix: run commands with args safely via execFileSync (no shell interpolation) */
function runCheckWithArgs(name: string, cmd: string, args: string[], projectDir: string, timeoutMs: number): CheckResult {
  const start = Date.now();
  try {
    execFileSync(cmd, args, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { name, passed: true, output: '', durationMs: Date.now() - start };
  } catch (err: unknown) {
    return { name, passed: false, output: String(getExecOutput(err)).slice(0, 500), durationMs: Date.now() - start };
  }
}

/**
 * Run quality checks on staged files before commit
 */
export function preCommitQualityRunner(input: HookInput): HookResult {
  // Skip if disabled
  if (process.env.ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS === 'true') {
    return outputSilentSuccess();
  }

  const command = input.tool_input?.command || '';
  if (!isCommitCommand(command)) return outputSilentSuccess();

  // Don't block --no-verify (user explicitly opted out) but log it
  if (/--no-verify/.test(command)) {
    logHook(HOOK_NAME, 'Commit bypassed quality checks with --no-verify', 'warn');
    return outputSilentSuccess();
  }

  const projectDir = getProjectDir();
  if (!projectDir) return outputSilentSuccess();

  const stagedFiles = getStagedSourceFiles();
  if (stagedFiles.length === 0) return outputSilentSuccess();

  logHook(HOOK_NAME, `${stagedFiles.length} staged files, running quality checks`);

  const checks: CheckResult[] = [];
  const hasPackageJson = existsSync(join(projectDir, 'package.json'));

  if (!hasPackageJson) return outputSilentSuccess();

  // TypeScript check
  if (hasTypeScriptFiles(stagedFiles)) {
    const hasTsConfig = existsSync(join(projectDir, 'tsconfig.json'));
    if (hasTsConfig) {
      checks.push(runCheckWithArgs('typecheck', 'npx', ['tsc', '--noEmit'], projectDir, 5000));
    }
  }

  // Lint check (only if eslint is available)
  if (hasLintableFiles(stagedFiles)) {
    const hasEslint = existsSync(join(projectDir, 'node_modules', '.bin', 'eslint')) ||
                      existsSync(join(projectDir, '.eslintrc.js')) ||
                      existsSync(join(projectDir, '.eslintrc.json')) ||
                      existsSync(join(projectDir, 'eslint.config.js')) ||
                      existsSync(join(projectDir, 'eslint.config.mjs'));
    if (hasEslint) {
      const lintFiles = stagedFiles.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));
      if (lintFiles.length > 0) {
        checks.push(runCheckWithArgs('lint', 'npx', ['eslint', '--cache', ...lintFiles], projectDir, 5000));
      }
    }
  }

  // Related tests (jest or vitest)
  if (hasSourceFiles(stagedFiles)) {
    const sourceFiles = stagedFiles.filter(f =>
      /\.(ts|tsx|js|jsx)$/.test(f) && !f.includes('.test.') && !f.includes('.spec.')
    );
    if (sourceFiles.length > 0) {
      const hasVitest = existsSync(join(projectDir, 'vitest.config.ts')) ||
                        existsSync(join(projectDir, 'vitest.config.mts')) ||
                        existsSync(join(projectDir, 'vitest.config.js'));
      const hasJest = existsSync(join(projectDir, 'jest.config.js')) ||
                      existsSync(join(projectDir, 'jest.config.ts'));
      if (hasVitest) {
        checks.push(runCheckWithArgs('related-tests', 'npx', ['vitest', 'run', '--related', ...sourceFiles, '--passWithNoTests'], projectDir, 5000));
      } else if (hasJest) {
        checks.push(runCheckWithArgs('related-tests', 'npx', ['jest', '--findRelatedTests', ...sourceFiles, '--passWithNoTests'], projectDir, 5000));
      }
    }
  }

  if (checks.length === 0) return outputSilentSuccess();

  const failures = checks.filter(c => !c.passed);
  const totalMs = checks.reduce((sum, c) => sum + c.durationMs, 0);

  if (failures.length > 0) {
    const failureReport = failures.map(f =>
      `${f.name} FAILED (${f.durationMs}ms):\n${f.output}`
    ).join('\n\n');

    logHook(HOOK_NAME, `${failures.length}/${checks.length} checks failed in ${totalMs}ms`);

    return outputBlock(
      `Pre-commit quality checks failed (${failures.length}/${checks.length}):\n\n${failureReport}\n\nFix the issues and try again. Skip with ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS=true for emergency commits.`
    );
  }

  logHook(HOOK_NAME, `All ${checks.length} checks passed in ${totalMs}ms`);

  // All passed — inject confirmation context
  const checkNames = checks.map(c => `${c.name} (${c.durationMs}ms)`).join(', ');
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse' as const,
      additionalContext: `[Pre-Commit] All quality checks passed: ${checkNames}`,
    },
  };
}
