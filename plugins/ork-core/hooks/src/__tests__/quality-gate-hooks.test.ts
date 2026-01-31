/**
 * Tier 3 Quality Gate Hooks - Comprehensive Test Suite
 *
 * Tests four quality gate hooks:
 * 1. coverageThresholdGate  - Coverage enforcement
 * 2. mergeReadinessChecker  - Pre-merge validation
 * 3. subagentQualityGate    - Subagent error tracking
 * 4. unifiedErrorHandler    - Error detection and suggestions
 *
 * All external I/O (fs, child_process, crypto) is mocked.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../types.js';

// ---------------------------------------------------------------------------
// Mock node:fs
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  renameSync: vi.fn(),
  readSync: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Mock node:child_process
// ---------------------------------------------------------------------------
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
}));

// ---------------------------------------------------------------------------
// Mock node:crypto
// ---------------------------------------------------------------------------
vi.mock('node:crypto', () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => 'mock-hash-abc123'),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are declared)
// ---------------------------------------------------------------------------
import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { mergeReadinessChecker } from '../skill/merge-readiness-checker.js';
import { subagentQualityGate } from '../subagent-stop/subagent-quality-gate.js';
import { unifiedErrorHandler } from '../posttool/unified-error-handler.js';

// ---------------------------------------------------------------------------
// Test Utilities
// ---------------------------------------------------------------------------

function createHookInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: {},
    ...overrides,
  };
}

function createBashInput(command: string, overrides: Partial<HookInput> = {}): HookInput {
  return createHookInput({
    tool_name: 'Bash',
    tool_input: { command },
    ...overrides,
  });
}

function createPostToolInput(overrides: Partial<HookInput> = {}): HookInput {
  return createHookInput({
    tool_name: 'Bash',
    tool_input: { command: 'npm test' },
    exit_code: 0,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Reset env vars that hooks read
  process.env.CLAUDE_PROJECT_DIR = '/test/project';
  process.env.CLAUDE_PLUGIN_ROOT = '/test/plugin';
  process.env.CLAUDE_SESSION_ID = 'test-session-123';
  delete process.env.COVERAGE_THRESHOLD;
  delete process.env.ORCHESTKIT_LOG_LEVEL;
  delete process.env.ORCHESTKIT_BRANCH;

  // Default: no files exist
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(readFileSync).mockReturnValue('');
  vi.mocked(statSync).mockReturnValue({ size: 0 } as any);
  vi.mocked(execSync).mockReturnValue('');
});

// =============================================================================
// 1. coverageThresholdGate
// =============================================================================

describe('coverageThresholdGate', () => {
  // -------------------------------------------------------------------------
  // No coverage file scenarios
  // -------------------------------------------------------------------------

  test('returns silent success when no coverage files exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when coverage file exists but is empty', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue('');

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when coverage file has unparseable JSON', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue('not valid json{{{');

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when coverage file has no recognized fields', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ unrelated: { data: 42 } }));

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Jest/Vitest coverage-summary.json format
  // -------------------------------------------------------------------------

  test('blocks when Jest lines.pct coverage is below default 80% threshold', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 65.4 }, statements: { pct: 70 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('65.4%');
    expect(result.stopReason).toContain('80%');
  });

  test('passes when Jest lines.pct coverage meets default 80% threshold', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 85.2 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('uses statements.pct as fallback when lines.pct is absent', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { statements: { pct: 92 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('blocks when coverage is exactly at boundary (79.9 floors to 79)', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 79.9 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('79.9%');
  });

  test('passes when coverage is exactly 80%', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 80 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Python coverage.json format
  // -------------------------------------------------------------------------

  test('parses Python coverage.json format with totals.percent_covered', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ totals: { percent_covered: 91.5 } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('blocks when Python coverage is below threshold', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ totals: { percent_covered: 42 } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('42%');
  });

  // -------------------------------------------------------------------------
  // Vitest coverage path
  // -------------------------------------------------------------------------

  test('reads .vitest/coverage/coverage-summary.json path', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('.vitest/coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 88 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Custom threshold via environment variable
  // -------------------------------------------------------------------------

  test('respects custom COVERAGE_THRESHOLD env var', () => {
    process.env.COVERAGE_THRESHOLD = '90';

    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 85 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('90%');
  });

  test('passes with custom lower threshold', () => {
    process.env.COVERAGE_THRESHOLD = '50';

    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 55 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Generic total.pct fallback
  // -------------------------------------------------------------------------

  test('parses generic total.pct field as fallback', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('htmlcov/status.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { pct: 95 } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // File read error handling
  // -------------------------------------------------------------------------

  test('skips file when readFileSync throws', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('EACCES permission denied');
    });

    const result = coverageThresholdGate(createHookInput());

    // All files fail to read, so no coverage data found = silent success
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Block output message content
  // -------------------------------------------------------------------------

  test('includes actionable guidance in block message', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).endsWith('coverage/coverage-summary.json'),
    );
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ total: { lines: { pct: 50 } } }),
    );

    const result = coverageThresholdGate(createHookInput());

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('BLOCKED');
    expect(result.stopReason).toContain('Actions required');
    expect(result.stopReason).toContain('npm test -- --coverage');
    expect(result.stopReason).toContain('pytest --cov');
  });
});

// =============================================================================
// 2. mergeReadinessChecker
// =============================================================================

describe('mergeReadinessChecker', () => {
  // -------------------------------------------------------------------------
  // Non-merge command passthrough
  // -------------------------------------------------------------------------

  test('returns silent success for non-merge commands', () => {
    const result = mergeReadinessChecker(createBashInput('git status'));

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success for git push', () => {
    const result = mergeReadinessChecker(createBashInput('git push origin main'));

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success for gh pr create', () => {
    const result = mergeReadinessChecker(createBashInput('gh pr create --title "test"'));

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when command is empty', () => {
    const result = mergeReadinessChecker(createHookInput({ tool_input: {} }));

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Merge command detection
  // -------------------------------------------------------------------------

  test('triggers checks for gh pr merge command', () => {
    // Setup: on feature branch, no uncommitted changes, no conflicts
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only') && cmdStr.includes('merge-base')) return '';
      if (cmdStr.includes('diff --name-only')) return 'src/index.ts';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge 42'));

    expect(stderrSpy).toHaveBeenCalled();
    expect(result.continue).toBe(true);

    stderrSpy.mockRestore();
  });

  test('triggers checks for git merge command', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('git merge main'));

    expect(result.continue).toBe(true);

    vi.restoreAllMocks();
  });

  test('triggers checks for git rebase command', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('git rebase main'));

    expect(result.continue).toBe(true);

    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Uncommitted changes blocker
  // -------------------------------------------------------------------------

  test('blocks merge when uncommitted changes exist', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return ' M src/index.ts\n?? newfile.ts';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge 42'));

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocker');

    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Branch divergence
  // -------------------------------------------------------------------------

  test('warns when branch is behind by 6-20 commits', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count') && cmdStr.includes('origin/main..feature')) return '3';
      if (cmdStr.includes('rev-list --count') && cmdStr.includes('feature..origin/main')) return '10';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge'));

    // Should pass with warnings, not block
    expect(result.continue).toBe(true);

    // Verify warning was written
    const stderrCalls = stderrSpy.mock.calls.map((c) => String(c[0]));
    const hasWarning = stderrCalls.some((c) => c.includes('WARNING') || c.includes('behind'));
    expect(hasWarning).toBe(true);

    stderrSpy.mockRestore();
  });

  test('blocks when branch is significantly behind (>20 commits)', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count') && cmdStr.includes('feature/test..origin')) return '25';
      if (cmdStr.includes('rev-list --count') && cmdStr.includes('origin/main..feature')) return '5';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge'));

    expect(result.continue).toBe(false);

    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Merge conflicts
  // -------------------------------------------------------------------------

  test('blocks when merge conflicts are detected', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'CONFLICT (content): Merge conflict in src/index.ts';
      if (cmdStr.includes('diff --name-only --diff-filter=U')) return 'src/index.ts\nsrc/utils.ts';
      if (cmdStr.includes('merge --abort')) return '';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockReturnValue(false);
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('git merge main'));

    expect(result.continue).toBe(false);
    expect(result.stopReason).toContain('blocker');

    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Already on target branch
  // -------------------------------------------------------------------------

  test('returns silent success when already on target branch', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'main';
      return '';
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('git merge feature'));

    expect(result.continue).toBe(true);

    stderrSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // Test suite detection
  // -------------------------------------------------------------------------

  test('detects package.json test script as frontend tests', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      return p.endsWith('package.json');
    });
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ scripts: { test: 'vitest run' } }));

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge'));

    expect(result.continue).toBe(true);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('test');

    stderrSpy.mockRestore();
  });

  test('detects pyproject.toml as backend test configuration', () => {
    vi.mocked(execSync).mockImplementation((cmd: any) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes('branch --show-current')) return 'feature/test';
      if (cmdStr.includes('rev-parse --show-toplevel')) return '/test/project';
      if (cmdStr.includes('status --short')) return '';
      if (cmdStr.includes('rev-list --count')) return '0';
      if (cmdStr.includes('merge --no-commit')) return 'Already up to date.';
      if (cmdStr.includes('merge-base')) return 'abc123';
      if (cmdStr.includes('diff --name-only')) return '';
      return '';
    });
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      return p.endsWith('pyproject.toml');
    });

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    const result = mergeReadinessChecker(createBashInput('gh pr merge'));

    expect(result.continue).toBe(true);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Backend test configuration found');

    stderrSpy.mockRestore();
  });
});

// =============================================================================
// 3. subagentQualityGate
// =============================================================================

describe('subagentQualityGate', () => {
  // -------------------------------------------------------------------------
  // No error - success path
  // -------------------------------------------------------------------------

  test('returns silent success when no error field', () => {
    const result = subagentQualityGate(
      createHookInput({
        agent_id: 'agent-1',
        subagent_type: 'code-reviewer',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when error is empty string', () => {
    const result = subagentQualityGate(
      createHookInput({
        agent_id: 'agent-1',
        subagent_type: 'code-reviewer',
        error: '',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success when error is literal "null"', () => {
    const result = subagentQualityGate(
      createHookInput({
        agent_id: 'agent-1',
        subagent_type: 'code-reviewer',
        error: 'null',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Error present - warning path
  // -------------------------------------------------------------------------

  test('returns warning when error is present', () => {
    const result = subagentQualityGate(
      createHookInput({
        agent_id: 'agent-1',
        subagent_type: 'test-runner',
        error: 'Timeout exceeded',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
    expect(result.systemMessage).toContain('test-runner');
    expect(result.systemMessage).toContain('Timeout exceeded');
  });

  test('warning message includes subagent type in message', () => {
    const result = subagentQualityGate(
      createHookInput({
        subagent_type: 'database-engineer',
        error: 'Connection failed',
      }),
    );

    expect(result.systemMessage).toContain('database-engineer');
    expect(result.systemMessage).toContain('Connection failed');
  });

  test('warning continues execution (does not block)', () => {
    const result = subagentQualityGate(
      createHookInput({
        error: 'Some error occurred',
        subagent_type: 'any-agent',
      }),
    );

    expect(result.continue).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Metrics tracking
  // -------------------------------------------------------------------------

  test('increments error count when metrics file exists', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path) === '/tmp/claude-session-metrics.json',
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 3 }));

    subagentQualityGate(
      createHookInput({
        error: 'Failed to complete task',
        subagent_type: 'test-runner',
      }),
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/claude-session-metrics.json',
      expect.stringContaining('"errors": 4'),
    );
  });

  test('initializes error count to 1 when metrics has no errors field', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path) === '/tmp/claude-session-metrics.json',
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ other: 'data' }));

    subagentQualityGate(
      createHookInput({
        error: 'Something broke',
        subagent_type: 'builder',
      }),
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/claude-session-metrics.json',
      expect.stringContaining('"errors": 1'),
    );
  });

  test('does not write metrics when metrics file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    subagentQualityGate(
      createHookInput({
        error: 'Something broke',
        subagent_type: 'builder',
      }),
    );

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  test('does not increment metrics when no error present', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 5 }));

    subagentQualityGate(createHookInput({ subagent_type: 'test-runner' }));

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  test('handles corrupt metrics file gracefully', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path) === '/tmp/claude-session-metrics.json',
    );
    vi.mocked(readFileSync).mockReturnValue('not-valid-json');

    // Should not throw
    const result = subagentQualityGate(
      createHookInput({
        error: 'Some error',
        subagent_type: 'test-runner',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  test('handles missing agent_id and subagent_type gracefully', () => {
    const result = subagentQualityGate(
      createHookInput({
        error: 'Unknown agent error',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.systemMessage).toBeDefined();
  });
});

// =============================================================================
// 4. unifiedErrorHandler
// =============================================================================

describe('unifiedErrorHandler', () => {
  // -------------------------------------------------------------------------
  // Trivial command skip
  // -------------------------------------------------------------------------

  test('skips trivial bash commands: echo', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'echo hello' },
        exit_code: 1,
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('skips trivial bash commands: ls', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'ls -la' },
        exit_code: 1,
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('skips trivial bash commands: pwd', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'pwd' },
        exit_code: 1,
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('skips trivial: cat', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'cat file.txt' },
        exit_code: 1,
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test.each(['head -n 10 file', 'tail -f log', 'wc -l file', 'date', 'whoami'])(
    'skips trivial command: %s',
    (command) => {
      const result = unifiedErrorHandler(
        createPostToolInput({
          tool_input: { command },
          exit_code: 1,
        }),
      );

      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    },
  );

  // -------------------------------------------------------------------------
  // No error detected - success
  // -------------------------------------------------------------------------

  test('returns silent success when exit code is 0 and no error patterns', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 0,
        tool_output: 'All tests passed',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  test('returns silent success for non-Bash tool with no error', () => {
    const result = unifiedErrorHandler(
      createHookInput({
        tool_name: 'Read',
        tool_input: { file_path: '/some/file.ts' },
        exit_code: 0,
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Error detection: exit code
  // -------------------------------------------------------------------------

  test('detects error from non-zero exit code', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
        tool_output: 'test output without error patterns',
      }),
    );

    // Should log the error (appendFileSync called)
    expect(appendFileSync).toHaveBeenCalled();
    expect(result.continue).toBe(true);
  });

  test('detects error from exit code 127 (command not found)', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'nonexistent-cmd' },
        exit_code: 127,
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error detection: tool_error field
  // -------------------------------------------------------------------------

  test('detects error from tool_error field', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'git push' },
        exit_code: 0,
        tool_error: 'Authentication failed for remote',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error detection: output pattern matching
  // -------------------------------------------------------------------------

  test('detects ERROR in tool output', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm run build' },
        exit_code: 0,
        tool_output: 'Compilation ERROR: Cannot find module',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  test('detects FATAL in tool output', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'node app.js' },
        exit_code: 0,
        tool_output: 'FATAL: Out of memory',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  test('detects "exception" in tool output', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'python app.py' },
        exit_code: 0,
        tool_output: 'Traceback (most recent call last):\n  exception occurred',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  test('detects "connection refused" in tool output', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'curl localhost:3000' },
        exit_code: 0,
        tool_output: 'connection refused at port 3000',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  test('detects ENOENT in tool output', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'node script.js' },
        exit_code: 0,
        tool_output: 'Error: ENOENT: no such file or directory',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  test('detects "timeout" in tool output', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 0,
        tool_output: 'Test timeout after 30000ms',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Error logging
  // -------------------------------------------------------------------------

  test('creates log directory before writing', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining('.claude/logs'),
      { recursive: true },
    );
  });

  test('writes structured error to JSONL log', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_name: 'Bash',
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
    const logCall = vi.mocked(appendFileSync).mock.calls[0];
    expect(String(logCall[0])).toContain('errors.jsonl');

    const logEntry = JSON.parse(String(logCall[1]).trim());
    expect(logEntry.tool).toBe('Bash');
    expect(logEntry.error_type).toBe('exit_code');
    expect(logEntry.timestamp).toBeDefined();
    expect(logEntry.session_id).toBeDefined();
  });

  test('updates session error metrics in /tmp', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      '/tmp/claude-session-errors.json',
      expect.any(String),
    );

    const metricsCall = vi.mocked(writeFileSync).mock.calls.find(
      (c) => String(c[0]) === '/tmp/claude-session-errors.json',
    );
    expect(metricsCall).toBeDefined();
    const metrics = JSON.parse(String(metricsCall![1]));
    expect(metrics.error_count).toBe(1);
    expect(metrics.last_error_tool).toBe('Bash');
  });

  test('increments existing error count in session metrics', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path) === '/tmp/claude-session-errors.json',
    );
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path) === '/tmp/claude-session-errors.json') {
        return JSON.stringify({ error_count: 5, last_error_tool: 'Read', last_error_time: '' });
      }
      return '';
    });

    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    const metricsCall = vi.mocked(writeFileSync).mock.calls.find(
      (c) => String(c[0]) === '/tmp/claude-session-errors.json',
    );
    expect(metricsCall).toBeDefined();
    const metrics = JSON.parse(String(metricsCall![1]));
    expect(metrics.error_count).toBe(6);
  });

  // -------------------------------------------------------------------------
  // Log rotation
  // -------------------------------------------------------------------------

  test('rotates log file when it exceeds 1MB', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path).includes('errors.jsonl'),
    );
    vi.mocked(statSync).mockReturnValue({ size: 1100 * 1024 } as any);

    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    expect(renameSync).toHaveBeenCalled();
    const renameCall = vi.mocked(renameSync).mock.calls[0];
    expect(String(renameCall[0])).toContain('errors.jsonl');
    expect(String(renameCall[1])).toContain('.old.');
  });

  // -------------------------------------------------------------------------
  // Solution suggestions (Bash only)
  // -------------------------------------------------------------------------

  test('suggests solution when error matches a known pattern', () => {
    const solutionsContent: any = {
      patterns: [
        {
          id: 'npm-install-fail',
          regex: 'npm install.*failed',
          category: 'npm',
          solution: {
            brief: 'npm install failed',
            steps: ['Delete node_modules', 'Run npm install again'],
          },
          skills: ['dependency-management'],
        },
      ],
      categories: {},
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return JSON.stringify(solutionsContent);
      return '';
    });

    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_name: 'Bash',
        tool_input: { command: 'npm install' },
        exit_code: 1,
        tool_error: 'npm install has failed',
      }),
    );

    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeDefined();
    expect(result.hookSpecificOutput?.additionalContext).toContain('npm install failed');
    expect(result.hookSpecificOutput?.additionalContext).toContain('Delete node_modules');
  });

  test('does not suggest solution for non-Bash tool errors', () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        patterns: [{ id: 'test', regex: 'error', solution: { brief: 'fix it' } }],
      }),
    );

    const result = unifiedErrorHandler(
      createHookInput({
        tool_name: 'Write',
        tool_input: { file_path: '/a.ts', content: '' },
        exit_code: 1,
        tool_error: 'error writing file',
      }),
    );

    // Should log but not return additionalContext
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  test('returns silent success when no error pattern matches', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) {
        return JSON.stringify({
          patterns: [{ id: 'specific', regex: 'very_specific_pattern_xyz', solution: { brief: 'fix' } }],
        });
      }
      return '';
    });

    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm run build' },
        exit_code: 1,
        tool_error: 'generic failure happened',
      }),
    );

    // Error is logged but no solution suggestion
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Dedup logic
  // -------------------------------------------------------------------------

  test('suppresses repeated suggestion for same pattern within threshold', () => {
    const solutionsContent = {
      patterns: [
        {
          id: 'test-pattern',
          regex: 'test failure',
          solution: { brief: 'Fix tests' },
        },
      ],
    };

    // First call: dedup file does not exist - suggestion should show
    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return JSON.stringify(solutionsContent);
      return '';
    });

    const result1 = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
        tool_error: 'test failure detected',
      }),
    );

    expect(result1.hookSpecificOutput?.additionalContext).toBeDefined();

    // Second call: dedup file exists with recent suggestion
    const dedupData = {
      suggestions: { 'mock-hash-abc123': { pattern_id: 'test-pattern', prompt_count: 1 } },
      prompt_count: 1,
    };

    vi.mocked(existsSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return true;
      if (p.includes('claude-error-suggestions')) return true;
      return false;
    });
    vi.mocked(readFileSync).mockImplementation((path) => {
      const p = String(path);
      if (p.includes('error_solutions.json')) return JSON.stringify(solutionsContent);
      if (p.includes('claude-error-suggestions')) return JSON.stringify(dedupData);
      return '';
    });

    const result2 = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
        tool_error: 'test failure detected',
      }),
    );

    // Should be suppressed (prompt_count 2 - last suggested at 1 = 1, < threshold 10)
    expect(result2.hookSpecificOutput?.additionalContext).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Crypto hash usage
  // -------------------------------------------------------------------------

  test('uses md5 hash for input dedup in error logging', () => {
    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
      }),
    );

    expect(createHash).toHaveBeenCalledWith('md5');
  });

  // -------------------------------------------------------------------------
  // Non-Bash tools with errors
  // -------------------------------------------------------------------------

  test('detects and logs error for Read tool with tool_error', () => {
    const result = unifiedErrorHandler(
      createHookInput({
        tool_name: 'Read',
        tool_input: { file_path: '/nonexistent' },
        tool_error: 'File does not exist',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
    expect(result.continue).toBe(true);
  });

  test('detects error for Write tool with non-zero exit code', () => {
    unifiedErrorHandler(
      createHookInput({
        tool_name: 'Write',
        tool_input: { file_path: '/readonly', content: 'data' },
        exit_code: 1,
        tool_error: 'EACCES: permission denied',
      }),
    );

    expect(appendFileSync).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  test('handles missing tool_name gracefully', () => {
    const result = unifiedErrorHandler(
      createHookInput({
        tool_name: '',
        exit_code: 1,
      }),
    );

    // Should still detect error from exit code
    expect(appendFileSync).toHaveBeenCalled();
    expect(result.continue).toBe(true);
  });

  test('handles undefined tool_output gracefully', () => {
    const result = unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 0,
        tool_output: undefined,
      }),
    );

    expect(result.continue).toBe(true);
  });

  test('truncates long error messages in log entries', () => {
    const longError = 'E'.repeat(2000);

    unifiedErrorHandler(
      createPostToolInput({
        tool_input: { command: 'npm test' },
        exit_code: 1,
        tool_error: longError,
      }),
    );

    const logCall = vi.mocked(appendFileSync).mock.calls[0];
    const logEntry = JSON.parse(String(logCall[1]).trim());
    // error_message should be truncated to 500 chars
    expect(logEntry.error_message.length).toBeLessThanOrEqual(500);
  });
});
