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
import type { HookInput, HookResult , HookContext} from '../../types.js';
import { outputSilentSuccess, outputBlock } from '../../lib/common.js';
import { getStagedSourceFiles } from '../../lib/git.js';
import { NOOP_CTX } from '../../lib/context.js';

const HOOK_NAME = 'pre-commit-quality-runner';

// Per-check budget. Cold-start of `tsc`/`vitest`/`eslint` via `npx` is ~5.6s in
// this repo, so the old 5000ms cap SIGKILLed a passing run mid-startup and the
// kill was misreported as a test failure — false-blocking essentially every
// source commit. 8000ms gives cold-start headroom, and a timeout is now treated
// as a non-blocking skip (see runCheckWithArgs + the failures filter), since the
// git pre-commit hook and CI run the authoritative, untimed versions of these
// same gates. This hook is a fast advisory pre-flight, not the source of truth.
const CHECK_TIMEOUT_MS = 8000;

interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
  /** True when the check was killed by its timeout instead of producing a real verdict. */
  timedOut: boolean;
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
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    return { name, passed: true, output: '', durationMs: Date.now() - start, timedOut: false };
  } catch (err: unknown) {
    // execFileSync sets `killed: true` + `signal: 'SIGTERM'` (and on some Node
    // versions `code: 'ETIMEDOUT'`) when the `timeout` fires. A killed check did
    // NOT produce a verdict — it's "couldn't finish in time", not "code is bad" —
    // so it must not block the commit. Real verdicts (non-zero exit with output)
    // still surface as failures below.
    const e = err as { killed?: boolean; signal?: string; code?: string };
    const timedOut = e?.killed === true || e?.signal === 'SIGTERM' || e?.code === 'ETIMEDOUT';
    return {
      name,
      passed: false,
      timedOut,
      output: timedOut
        ? `did not finish within ${timeoutMs}ms — skipped (cold start, not a failure). The git pre-commit hook and CI run the authoritative gate.`
        : String(getExecOutput(err)).slice(0, 500),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Run quality checks on staged files before commit
 */
export function preCommitQualityRunner(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  // Skip if disabled
  if (process.env.ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS === 'true') {
    return outputSilentSuccess();
  }

  const command = input.tool_input?.command || '';
  if (!isCommitCommand(command)) return outputSilentSuccess();

  // Don't block --no-verify (user explicitly opted out) but log it
  if (/--no-verify/.test(command)) {
    ctx.log(HOOK_NAME, 'Commit bypassed quality checks with --no-verify', 'warn');
    return outputSilentSuccess();
  }

  const projectDir = ctx.projectDir;
  if (!projectDir) return outputSilentSuccess();

  const stagedFiles = getStagedSourceFiles();
  if (stagedFiles.length === 0) return outputSilentSuccess();

  ctx.log(HOOK_NAME, `${stagedFiles.length} staged files, running quality checks`);

  const checks: CheckResult[] = [];
  const hasPackageJson = existsSync(join(projectDir, 'package.json'));

  if (!hasPackageJson) return outputSilentSuccess();

  // TypeScript check
  if (hasTypeScriptFiles(stagedFiles)) {
    const hasTsConfig = existsSync(join(projectDir, 'tsconfig.json'));
    if (hasTsConfig) {
      checks.push(runCheckWithArgs('typecheck', 'npx', ['tsc', '--noEmit'], projectDir, CHECK_TIMEOUT_MS));
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
        checks.push(runCheckWithArgs('lint', 'npx', ['eslint', '--cache', ...lintFiles], projectDir, CHECK_TIMEOUT_MS));
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
        // `related` is a vitest SUBCOMMAND, not a flag — `vitest run --related`
        // throws CACError "Unknown option `--related`" and fails every commit
        // that stages source files.
        checks.push(runCheckWithArgs('related-tests', 'npx', ['vitest', 'related', ...sourceFiles, '--run', '--passWithNoTests'], projectDir, CHECK_TIMEOUT_MS));
      } else if (hasJest) {
        checks.push(runCheckWithArgs('related-tests', 'npx', ['jest', '--findRelatedTests', ...sourceFiles, '--passWithNoTests'], projectDir, CHECK_TIMEOUT_MS));
      }
    }
  }

  if (checks.length === 0) return outputSilentSuccess();

  // A timed-out check produced no verdict — it's advisory-skipped, never blocking.
  // Only checks that actually RAN and reported errors block the commit.
  const failures = checks.filter(c => !c.passed && !c.timedOut);
  const skipped = checks.filter(c => c.timedOut);
  const totalMs = checks.reduce((sum, c) => sum + c.durationMs, 0);

  if (skipped.length > 0) {
    ctx.log(
      HOOK_NAME,
      `${skipped.length}/${checks.length} checks skipped on timeout (${skipped.map(c => c.name).join(', ')}) — git pre-commit hook + CI cover these`,
      'warn',
    );
  }

  if (failures.length > 0) {
    const failureReport = failures.map(f =>
      `${f.name} FAILED (${f.durationMs}ms):\n${f.output}`
    ).join('\n\n');

    ctx.log(HOOK_NAME, `${failures.length}/${checks.length} checks failed in ${totalMs}ms`);

    return outputBlock(
      `Pre-commit quality checks failed (${failures.length}/${checks.length}):\n\n${failureReport}\n\nFix the issues and try again. Skip with ORCHESTKIT_SKIP_PRE_COMMIT_CHECKS=true for emergency commits.`
    );
  }

  const ranNames = checks.filter(c => c.passed).map(c => `${c.name} (${c.durationMs}ms)`).join(', ');
  ctx.log(HOOK_NAME, `${checks.length - skipped.length}/${checks.length} checks passed in ${totalMs}ms`);

  // Nothing blocking — inject confirmation context. Preserve the clean all-pass
  // wording when nothing was skipped; only diverge to flag advisory timeouts.
  const additionalContext = skipped.length > 0
    ? `[Pre-Commit] No blocking issues — passed: ${ranNames || 'none'} · skipped on timeout (advisory, covered by git-hook + CI): ${skipped.map(c => c.name).join(', ')}`
    : `[Pre-Commit] All quality checks passed: ${ranNames}`;
  return {
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse' as const,
      additionalContext,
    },
  };
}
