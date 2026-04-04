/**
 * Unit tests for project-write-retry PermissionDenied hook
 * Tests retry logic for in-project Write/Edit after denial
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { projectWriteRetry } from '../../permission-denied/project-write-retry.js';
import type { HookInput } from '../../types.js';
import { createTestContext } from '../fixtures/test-context.js';

// Mock the common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
    outputSilentSuccess: () => ({ continue: true, suppressOutput: true }),
  };
});

/**
 * Create a mock HookInput for a denied Write/Edit
 */
function createDeniedWriteInput(
  filePath: string,
  options?: { projectDir?: string; addedDirs?: string[]; toolName?: string }
): HookInput {
  return {
    tool_name: options?.toolName ?? 'Write',
    session_id: 'test-session-123',
    tool_input: { file_path: filePath, content: 'test content' },
    project_dir: options?.projectDir ?? '/test/project',
    hook_event: 'PermissionDenied',
    added_dirs: options?.addedDirs,
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('project-write-retry', () => {
  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
  });

  describe('In-project writes return {retry: true}', () => {
    const projectPaths = [
      '/test/project/src/index.ts',
      '/test/project/lib/utils.js',
      '/test/project/tests/test.spec.ts',
      '/test/project/README.md',
      '/test/project/package.json',
      '/test/project/tsconfig.json',
      '/test/project/.github/workflows/ci.yml',
      '/test/project/deep/nested/path/file.txt',
    ];

    test.each(projectPaths)('retries in-project write: %s', (filePath) => {
      // Arrange
      const input = createDeniedWriteInput(filePath);

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBe(true);
      expect(result.hookSpecificOutput?.hookEventName).toBe('PermissionDenied');
      expect(result.hookSpecificOutput?.additionalContext).toContain('incorrectly denied');
    });
  });

  describe('Writes outside project NOT retried', () => {
    const outsidePaths = [
      '/home/user/sensitive-file.txt',
      '/etc/passwd',
      '/usr/local/bin/script.sh',
      '/var/log/system.log',
      '/tmp/temp-file.txt',
      '/another/project/file.ts',
      '/root/.ssh/authorized_keys',
    ];

    test.each(outsidePaths)('does not retry outside-project write: %s', (filePath) => {
      // Arrange
      const input = createDeniedWriteInput(filePath);

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('Writes to excluded dirs NOT retried', () => {
    const excludedPaths = [
      '/test/project/node_modules/package/index.js',
      '/test/project/.git/config',
      '/test/project/.git/hooks/pre-commit',
      '/test/project/dist/bundle.js',
      '/test/project/build/output.js',
      '/test/project/__pycache__/module.pyc',
      '/test/project/.venv/lib/site-packages/pkg.py',
      '/test/project/venv/bin/python',
    ];

    test.each(excludedPaths)('does not retry excluded dir write: %s', (filePath) => {
      // Arrange
      const input = createDeniedWriteInput(filePath);

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('added_dirs support', () => {
    test('retries write inside an added_dir', () => {
      // Arrange
      const input = createDeniedWriteInput('/other/service/src/main.ts', {
        addedDirs: ['/other/service'],
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBe(true);
      expect(result.hookSpecificOutput?.additionalContext).toContain('added dir');
    });

    test('does not retry paths outside both project_dir and added_dirs', () => {
      // Arrange
      const input = createDeniedWriteInput('/unrelated/file.ts', {
        addedDirs: ['/other/service'],
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    test('still blocks excluded dirs inside an added_dir', () => {
      // Arrange
      const input = createDeniedWriteInput('/other/service/node_modules/pkg/index.js', {
        addedDirs: ['/other/service'],
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    test('works correctly with empty added_dirs array', () => {
      // Arrange
      const input = createDeniedWriteInput('/test/project/src/index.ts', {
        addedDirs: [],
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    test('works correctly when added_dirs is undefined', () => {
      // Arrange
      const input = createDeniedWriteInput('/test/project/src/index.ts');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    test('guards against prefix attack in added_dirs', () => {
      // Arrange — /other/service-evil is NOT inside /other/service
      const input = createDeniedWriteInput('/other/service-evil/file.ts', {
        addedDirs: ['/other/service'],
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('Relative paths resolved correctly', () => {
    test('resolves relative path against project_dir', () => {
      // Arrange
      const input = createDeniedWriteInput('src/index.ts');

      // Act
      const result = projectWriteRetry(input);

      // Assert — relative path resolved to /test/project/src/index.ts
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    test('resolves dot-prefixed relative path', () => {
      // Arrange
      const input = createDeniedWriteInput('./lib/utils.js');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    test('path traversal outside project not retried', () => {
      // Arrange — ../../etc/passwd escapes project directory
      const input = createDeniedWriteInput('/test/project/../../../etc/passwd');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    test('empty file_path returns silent success', () => {
      // Arrange
      const input = createDeniedWriteInput('');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    test('undefined file_path returns silent success', () => {
      // Arrange
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'test' },
        project_dir: '/test/project',
      };

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    test('Edit tool behaves same as Write', () => {
      // Arrange
      const input = createDeniedWriteInput('/test/project/src/file.ts', {
        toolName: 'Edit',
      });

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBe(true);
    });

    test('blocks symbolic project path prefix attack', () => {
      // Arrange — /test/project-malicious is NOT inside /test/project
      const input = createDeniedWriteInput('/test/project-malicious/file.txt');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result.hookSpecificOutput?.retry).toBeUndefined();
    });

    test('retry result has correct structure', () => {
      // Arrange
      const input = createDeniedWriteInput('/test/project/src/index.ts');

      // Act
      const result = projectWriteRetry(input);

      // Assert
      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
        hookSpecificOutput: {
          hookEventName: 'PermissionDenied',
          retry: true,
          additionalContext: expect.stringContaining('incorrectly denied'),
        },
      });
    });
  });
});
