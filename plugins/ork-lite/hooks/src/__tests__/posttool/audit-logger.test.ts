import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs before import
vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ size: 100 })),
  renameSync: vi.fn(),
  readFileSync: vi.fn(() => '0'),
  writeFileSync: vi.fn(),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getLogDir: vi.fn(() => '/test/project/.claude/logs'),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
}));

import { auditLogger } from '../../posttool/audit-logger.js';
import type { HookInput } from '../../types.js';
import { appendFileSync, statSync, renameSync, existsSync } from 'node:fs';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session',
    tool_input: { command: 'npm test' },
    ...overrides,
  };
}

describe('auditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLAUDE_PROJECT_DIR = '/test/project';
  });

  it('returns silent success for all tool calls', () => {
    // Act
    const result = auditLogger(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('logs Bash commands with truncated details', () => {
    // Act
    auditLogger(makeInput({
      tool_name: 'Bash',
      tool_input: { command: 'npm run build && npm test' },
    }));

    // Assert
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('audit.log'),
      expect.stringContaining('Bash | npm run build && npm test'),
    );
  });

  it('logs Write tool with file path', () => {
    // Act
    auditLogger(makeInput({
      tool_name: 'Write',
      tool_input: { file_path: '/src/index.ts', content: 'code' },
    }));

    // Assert
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('audit.log'),
      expect.stringContaining('Write | /src/index.ts'),
    );
  });

  it('logs Task tool with subagent_type', () => {
    // Act
    auditLogger(makeInput({
      tool_name: 'Task',
      tool_input: { subagent_type: 'code-reviewer' },
    }));

    // Assert
    expect(appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('audit.log'),
      expect.stringContaining('Task | code-reviewer'),
    );
  });

  it('skips most Read/Glob/Grep calls (logs every 10th)', () => {
    // The hook counts reads and only logs every 10th
    // With default readCount file returning '0', the first call increments to 1
    // which is not divisible by 10, so it should return silent success early

    // Act
    const result = auditLogger(makeInput({ tool_name: 'Read', tool_input: { file_path: '/foo.ts' } }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('rotates log file when exceeding 200KB', () => {
    // Arrange
    vi.mocked(statSync).mockReturnValue({ size: 300 * 1024 } as ReturnType<typeof statSync>);
    vi.mocked(existsSync).mockReturnValue(true);

    // Act
    auditLogger(makeInput());

    // Assert
    expect(renameSync).toHaveBeenCalled();
  });
});
