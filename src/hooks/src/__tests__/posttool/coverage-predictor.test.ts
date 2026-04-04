import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

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

vi.mock('../../lib/common.js', () => mockCommonBasic({
  getProjectDir: vi.fn(() => '/home/user/myproject'),
}));

import { coveragePredictor } from '../../posttool/write/coverage-predictor.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

function makeInput(overrides: Partial<HookInput> = {}): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session',
    tool_input: { file_path: '/home/user/myproject/src/services/auth.ts', content: 'export function login() {}' },
    ...overrides,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('coveragePredictor', () => {
  beforeEach(() => {
    testCtx = createTestContext({ projectDir: '/home/user/myproject' });
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
