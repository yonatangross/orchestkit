/**
 * Tier 3 Quality Gate Hooks - Comprehensive Test Suite
 *
 * Tests three quality gate hooks:
 * 1. coverageThresholdGate  - Coverage enforcement
 * 3. subagentQualityGate    - Subagent error tracking
 *
 * All external I/O (fs, child_process, crypto) is mocked.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { HookInput } from '../types.js';
import { getMetricsFile, } from '../lib/paths.js';

// ---------------------------------------------------------------------------
// Hoisted mocks — shared between analytics-buffer, node:fs, and atomic-write mocks
// ---------------------------------------------------------------------------
const { mockAppendFileSync, mockWriteFileSync } = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock analytics-buffer — bridges bufferWrite to mockAppendFileSync for assertions
// ---------------------------------------------------------------------------
vi.mock('../lib/analytics-buffer.js', () => ({
  bufferWrite: vi.fn((filePath: string, content: string) => {
    mockAppendFileSync(filePath, content);
  }),
  flush: vi.fn(),
  pendingCount: vi.fn(() => 0),
  _resetForTesting: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock node:os — ensures os.tmpdir() returns '/tmp' consistently in tests
// ---------------------------------------------------------------------------
vi.mock('node:os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  homedir: vi.fn(() => '/home/test'),
  default: { tmpdir: () => '/tmp', homedir: () => '/home/test' },
}));

// ---------------------------------------------------------------------------
// Mock node:fs
// ---------------------------------------------------------------------------
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: mockWriteFileSync,
  appendFileSync: mockAppendFileSync,
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 0 })),
  renameSync: vi.fn(),
  readSync: vi.fn(() => 0),
}));

// ---------------------------------------------------------------------------
// Mock atomic-write — delegates to mocked writeFileSync
// ---------------------------------------------------------------------------
vi.mock('../lib/atomic-write.js', () => ({
  atomicWriteSync: (path: string, content: string) => mockWriteFileSync(path, content),
}));

// ---------------------------------------------------------------------------
// Mock node:child_process
// ---------------------------------------------------------------------------
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => ''),
  execFileSync: vi.fn(() => ''),
}));

// ---------------------------------------------------------------------------
// Mock lib/git-head (#2970)
// ---------------------------------------------------------------------------
// Branch resolution parses .git/HEAD instead of spawning `git branch
// --show-current`, so the branch a case wants is set here rather than via the
// execFileSync mock below. Every other git call in these tests still shells
// out and is still mocked above.
vi.mock('../lib/git-head.js', () => ({
  readBranchFromHead: vi.fn(() => 'feature/test'),
  readBranchOr: vi.fn(() => 'feature/test'),
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
import { existsSync, readFileSync, writeFileSync, statSync, } from 'node:fs';
import { execSync, execFileSync } from 'node:child_process';

import { coverageThresholdGate } from '../skill/coverage-threshold-gate.js';
import { subagentQualityGate } from '../subagent-stop/subagent-quality-gate.js';

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
  vi.mocked(execFileSync).mockReturnValue('');
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
// mergeReadinessChecker was deleted in #3461: it lived in the entries map
// with no hooks.json entry, so it was never invoked (the #959 class). Its
// tests are removed with it rather than kept against a deleted module.


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
      String(path) === getMetricsFile(),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ errors: 3 }));

    subagentQualityGate(
      createHookInput({
        error: 'Failed to complete task',
        subagent_type: 'test-runner',
      }),
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      getMetricsFile(),
      expect.stringContaining('"errors": 4'),
    );
  });

  test('initializes error count to 1 when metrics has no errors field', () => {
    vi.mocked(existsSync).mockImplementation((path) =>
      String(path) === getMetricsFile(),
    );
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ other: 'data' }));

    subagentQualityGate(
      createHookInput({
        error: 'Something broke',
        subagent_type: 'builder',
      }),
    );

    expect(writeFileSync).toHaveBeenCalledWith(
      getMetricsFile(),
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
      String(path) === getMetricsFile(),
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
