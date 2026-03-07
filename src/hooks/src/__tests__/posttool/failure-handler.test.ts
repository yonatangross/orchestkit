import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock common (output builders + logging) — these are presentation, not logic
vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: { additionalContext: ctx },
  })),
}));

// Mock paths — controls where state files go
vi.mock('../../lib/paths.js', () => ({
  getLogDir: vi.fn(() => '/tmp/test-logs'),
}));

// DO NOT mock node:fs or atomic-write — let trackFailureAndMaybeEnableDebug run for real
// Instead, mock at the granular level so we can observe actual calls
vi.mock('../../lib/atomic-write.js', () => ({
  atomicWriteSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => '{}'),
  mkdirSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
}));

import { failureHandler } from '../../posttool/failure-handler.js';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { atomicWriteSync } from '../../lib/atomic-write.js';
import { logHook } from '../../lib/common.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

describe('failureHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns silent success when no error', () => {
    const result = failureHandler(makeInput({ exit_code: 0 }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('suggests fix for file not found errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('File not found');
  });

  it('suggests fix for permission denied errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'EACCES: permission denied',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Permission denied');
  });

  it('suggests fix for timeout errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'Command timed out after 120000ms',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('timed out');
  });

  it('returns silent success for unknown error patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'some unknown error xyz',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles multiple matching patterns', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOENT: no such file or directory, syntax error in config',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    const ctx = result.hookSpecificOutput?.additionalContext || '';
    expect(ctx).toContain('File not found');
    expect(ctx).toContain('Syntax error');
  });
});

describe('failureHandler — additional error patterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suggests fix for network errors (ECONNREFUSED)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ECONNREFUSED: connection refused to localhost:5432',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Network error');
  });

  it('suggests fix for network errors (ETIMEDOUT)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ETIMEDOUT: request timed out',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Network error');
  });

  it('suggests fix for command not found', () => {
    const result = failureHandler(makeInput({
      tool_error: 'npx: command not found',
      exit_code: 127,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Command not found');
  });

  it('suggests fix for out of memory errors (ENOMEM)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ENOMEM: not enough memory',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Out of memory');
  });

  it('suggests fix for out of memory errors (heap)', () => {
    const result = failureHandler(makeInput({
      tool_error: 'JavaScript heap out of memory',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Out of memory');
  });

  it('suggests fix for merge conflicts', () => {
    const result = failureHandler(makeInput({
      tool_error: 'CONFLICT (content): Merge conflict in src/index.ts',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Merge conflict');
  });

  it('suggests fix for resource lock errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'ELOCK: file is locked by another process',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Resource is locked');
  });

  it('suggests fix for type errors', () => {
    const result = failureHandler(makeInput({
      tool_error: 'TypeError: Cannot read properties of undefined',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Type error');
  });

  it('includes tool name in context header', () => {
    const result = failureHandler(makeInput({
      tool_name: 'Write',
      tool_error: 'ENOENT: no such file or directory',
      exit_code: 1,
    }));
    expect(result.hookSpecificOutput?.additionalContext).toContain('Write');
  });

  it('handles empty tool_error with non-zero exit code', () => {
    const result = failureHandler(makeInput({
      tool_error: '',
      exit_code: 1,
    }));
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});

describe('trackFailureAndMaybeEnableDebug (via failureHandler)', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalHome = process.env.HOME;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = '/mock-home';
    stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    stderrSpy.mockRestore();
  });

  it('writes count=1 on first failure (no prior count file)', () => {
    // existsSync: false for log dir, false for count file, (threshold not reached so no flag check)
    vi.mocked(existsSync).mockReturnValue(false);

    failureHandler(makeInput({ tool_error: 'ENOENT: file missing', exit_code: 1 }));

    // Should create log dir
    expect(mkdirSync).toHaveBeenCalledWith('/tmp/test-logs', { recursive: true });
    // Should write count=1
    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/tmp/test-logs/failure-count.json',
      expect.stringContaining('"count":1'),
    );
    // Should NOT write debug flag (count=1 < threshold=3)
    expect(atomicWriteSync).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('increments existing count (count 1 → 2)', () => {
    // Log dir exists, count file exists with count=1
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('failure-count.json')) return true;
      if (path === '/tmp/test-logs') return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue('{"count":1}');

    failureHandler(makeInput({ tool_error: 'ENOENT: missing', exit_code: 1 }));

    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/tmp/test-logs/failure-count.json',
      expect.stringContaining('"count":2'),
    );
    // Still below threshold — no debug flag
    expect(atomicWriteSync).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('enables debug mode at count=3 (threshold)', () => {
    // Count file has count=2, flag file does NOT exist
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('failure-count.json')) return true;
      if (path === '/tmp/test-logs') return true;
      if (path.includes('debug-mode.flag')) return false;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue('{"count":2}');

    failureHandler(makeInput({ tool_error: 'ENOENT: gone', exit_code: 1 }));

    // Should write count=3
    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/tmp/test-logs/failure-count.json',
      expect.stringContaining('"count":3'),
    );
    // Should write debug flag file
    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/mock-home/.claude/logs/ork/debug-mode.flag',
      expect.stringMatching(/enabled=.*\nreason=auto-3-failures/),
    );
    expect(atomicWriteSync).toHaveBeenCalledTimes(2);

    // Should log warning
    expect(logHook).toHaveBeenCalledWith('failure-handler', expect.stringContaining('Auto-enabled debug'), 'warn');

    // Should write to stderr
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('Debug mode auto-enabled after 3 tool failures'),
    );
  });

  it('does NOT double-write debug flag if already exists', () => {
    // Count file has count=2, flag file ALREADY exists
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('failure-count.json')) return true;
      if (path === '/tmp/test-logs') return true;
      if (path.includes('debug-mode.flag')) return true; // already enabled
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue('{"count":2}');

    failureHandler(makeInput({ tool_error: 'ENOENT: gone', exit_code: 1 }));

    // Should write count=3 but NOT the flag file
    expect(atomicWriteSync).toHaveBeenCalledTimes(1);
    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/tmp/test-logs/failure-count.json',
      expect.stringContaining('"count":3'),
    );
    // No stderr output since flag already exists
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('does NOT re-trigger debug at count=4 (past threshold)', () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('failure-count.json')) return true;
      if (path === '/tmp/test-logs') return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue('{"count":3}');

    failureHandler(makeInput({ tool_error: 'ENOENT: gone again', exit_code: 1 }));

    // Should write count=4
    expect(atomicWriteSync).toHaveBeenCalledWith(
      '/tmp/test-logs/failure-count.json',
      expect.stringContaining('"count":4'),
    );
    // Should NOT write debug flag (only triggers at exactly FAILURE_THRESHOLD)
    expect(atomicWriteSync).toHaveBeenCalledTimes(1);
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('handles corrupt count file gracefully (starts at count=1)', () => {
    vi.mocked(existsSync).mockImplementation((p) => {
      const path = String(p);
      if (path.includes('failure-count.json')) return true;
      if (path === '/tmp/test-logs') return true;
      return false;
    });
    vi.mocked(readFileSync).mockReturnValue('NOT VALID JSON!!!');

    // Should not throw — the try/catch in trackFailureAndMaybeEnableDebug swallows errors
    failureHandler(makeInput({ tool_error: 'ENOENT: corrupt', exit_code: 1 }));

    // Pattern matching still works even if tracking fails
    expect(failureHandler(makeInput({ tool_error: 'ENOENT: test', exit_code: 1 })).continue).toBe(true);
  });

  it('skips tracking when exit_code is 0 and no error', () => {
    failureHandler(makeInput({ exit_code: 0 }));

    // No failure tracking should happen
    expect(atomicWriteSync).not.toHaveBeenCalled();
    expect(mkdirSync).not.toHaveBeenCalled();
  });
});
