/**
 * Unit tests for affected-tests-finder hook
 * Tests detection of related test files for changed source files
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockCommonBasic } from '../fixtures/mock-common.js';

// Mock dependencies before imports
vi.mock('../../lib/common.js', () => mockCommonBasic());

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(() => ''),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('node:path', () => ({
  join: vi.fn((...args: string[]) => args.join('/')),
  basename: vi.fn((p: string) => p.split('/').pop() || ''),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
}));

import { affectedTestsFinder } from '../../pretool/bash/affected-tests-finder.js';
import type { HookInput } from '../../types.js';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
  };
}

describe('affected-tests-finder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(existsSync).mockReturnValue(false);
  });

  it('returns silent success for non-git-push commands', () => {
    // Arrange
    const input = createBashInput('npm run build');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success for npm test commands (already testing)', () => {
    // Arrange
    const input = createBashInput('npm run test');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('returns silent success when no changed files', () => {
    // Arrange
    vi.mocked(execFileSync).mockReturnValue('');
    const input = createBashInput('git push origin main');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('suggests related tests when changed files have corresponding tests', () => {
    // Arrange
    vi.mocked(execFileSync).mockReturnValue(' M src/services/auth.ts\n');
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      if (typeof p === 'string' && p.includes('auth.test.ts')) return true;
      return false;
    });
    const input = createBashInput('git push origin main');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.hookSpecificOutput?.additionalContext).toContain('Related tests');
  });

  it('returns silent success when changed files have no matching tests', () => {
    // Arrange
    vi.mocked(execFileSync).mockReturnValue(' M src/config/settings.ts\n');
    vi.mocked(existsSync).mockReturnValue(false);
    const input = createBashInput('git push origin main');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });

  it('handles git command failure gracefully', () => {
    // Arrange
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('not a git repository');
    });
    const input = createBashInput('git push origin main');

    // Act
    const result = affectedTestsFinder(input);

    // Assert
    expect(result.continue).toBe(true);
    expect(result.suppressOutput).toBe(true);
  });
});
