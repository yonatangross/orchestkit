import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

const mockExecSync = vi.fn();
vi.mock('node:child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
}));

vi.mock('node:path', () => ({
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
}));

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  getField: vi.fn((input: Record<string, unknown>, path: string) => {
    const parts = path.split('.');
    let val: unknown = input;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return undefined;
    }
    return val;
  }),
  getProjectDir: vi.fn(() => '/home/user/myproject'),
}));

import { coveragePredictor } from '../../posttool/write/coverage-predictor.js';
import type { HookInput } from '../../types.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: '/home/user/myproject/src/services/auth.ts', content: 'export function login() {}' },
    ...overrides,
  };
}

describe('coveragePredictor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    // Default: no test file found
    mockExecSync.mockReturnValue('');
  });

  it('returns silent success for non-Write tools', () => {
    // Act
    const result = coveragePredictor(makeInput({ tool_name: 'Edit' }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips test files (files containing "test" in path)', () => {
    // Act
    const result = coveragePredictor(makeInput({
      tool_input: { file_path: '/test/project/src/__tests__/auth.test.ts', content: 'test code' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('skips non-code files like .md or .json', () => {
    // Act
    const result = coveragePredictor(makeInput({
      tool_input: { file_path: '/test/project/README.md', content: '# Readme' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns system message when no test file exists', () => {
    // Arrange
    mockExecSync.mockReturnValue('');

    // Act
    const result = coveragePredictor(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    expect(result.systemMessage).toContain('Consider adding tests');
  });

  it('returns silent success when test file exists', () => {
    // Arrange
    mockExecSync.mockReturnValue('/test/project/src/__tests__/auth.test.ts');

    // Act
    const result = coveragePredictor(makeInput());

    // Assert
    expect(result.continue).toBe(true);
    // Should not suggest adding tests since they exist
    expect(result.systemMessage).toBeUndefined();
  });

  it('skips when file_path is empty', () => {
    // Act
    const result = coveragePredictor(makeInput({
      tool_input: { content: 'code' },
    }));

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});
