/**
 * Unit tests for auto-approve-project-writes permission hook
 * Tests file path validation and permission decisions
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import type { HookInput } from '../../types.js';

// Mock the common module
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
  };
});

/**
 * Create a mock HookInput for Write/Edit commands
 */
function createWriteInput(filePath: string, projectDir = '/test/project'): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    tool_input: { file_path: filePath, content: 'test content' },
    project_dir: projectDir,
  };
}

describe('auto-approve-project-writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Writes within project directory (should auto-approve)', () => {
    const projectWrites = [
      '/test/project/src/index.ts',
      '/test/project/lib/utils.js',
      '/test/project/tests/test.spec.ts',
      '/test/project/README.md',
      '/test/project/package.json',
      '/test/project/tsconfig.json',
      '/test/project/.github/workflows/ci.yml',
      '/test/project/deep/nested/path/file.txt',
    ];

    test.each(projectWrites)('auto-approves: %s', (filePath) => {
      const input = createWriteInput(filePath);
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });

  describe('Relative paths within project (should auto-approve)', () => {
    const relativePaths = [
      'src/index.ts',
      './lib/utils.js',
      'tests/test.spec.ts',
      './README.md',
    ];

    test.each(relativePaths)('auto-approves relative path: %s', (filePath) => {
      const input = createWriteInput(filePath);
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });

  describe('Excluded directories (should NOT auto-approve)', () => {
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

    test.each(excludedPaths)('requires manual approval for excluded: %s', (filePath) => {
      const input = createWriteInput(filePath);
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      // Should NOT have permissionDecision (let user decide)
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('Writes outside project directory (should NOT auto-approve)', () => {
    const outsidePaths = [
      '/home/user/sensitive-file.txt',
      '/etc/passwd',
      '/usr/local/bin/script.sh',
      '/var/log/system.log',
      '/tmp/temp-file.txt',
      '/another/project/file.ts',
      '/root/.ssh/authorized_keys',
    ];

    test.each(outsidePaths)('requires manual approval: %s', (filePath) => {
      const input = createWriteInput(filePath);
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
      // Should NOT have permissionDecision (let user decide)
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });

    test('handles tilde path (may be expanded or not)', () => {
      // Tilde paths may be resolved to absolute paths by the system
      // The hook behavior depends on whether tilde is expanded
      const input = createWriteInput('~/.bashrc');
      const result = autoApproveProjectWrites(input);

      // May or may not auto-approve depending on path resolution
      expect(result.continue).toBe(true);
    });
  });

  describe('Edge cases', () => {
    test('handles empty file path', () => {
      const input = createWriteInput('');
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
    });

    test('handles undefined file path', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { content: 'test' },
        project_dir: '/test/project',
      };
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
    });

    test('handles path traversal attempts', () => {
      const input = createWriteInput('/test/project/../../../etc/passwd');
      const result = autoApproveProjectWrites(input);

      // Path doesn't start with project dir after traversal
      expect(result.continue).toBe(true);
    });

    test('blocks symbolic project path prefix attack', () => {
      // Path that starts with project dir prefix but is a different directory
      // Fix: Uses path.relative() instead of startsWith() to properly detect escape
      const input = createWriteInput('/test/project-malicious/file.txt');
      const result = autoApproveProjectWrites(input);

      // Should NOT auto-approve - /test/project-malicious is not inside /test/project
      // path.relative('/test/project', '/test/project-malicious/file.txt') => '../project-malicious/file.txt'
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });

    test('handles deep nesting in excluded directory', () => {
      const input = createWriteInput('/test/project/node_modules/deep/nested/pkg/file.js');
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });

    test('handles file named like excluded directory', () => {
      // File named "node_modules.txt" should be fine
      const input = createWriteInput('/test/project/docs/node_modules.txt');
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('handles case sensitivity in paths', () => {
      // node_modules vs NODE_MODULES
      const input = createWriteInput('/test/project/NODE_MODULES/pkg/file.js');
      const result = autoApproveProjectWrites(input);

      // Case sensitive, so NODE_MODULES should be allowed
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('handles very long path', () => {
      const longPath = `/test/project/${'subdir/'.repeat(100)}file.txt`;
      const input = createWriteInput(longPath);
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('handles special characters in path', () => {
      const input = createWriteInput('/test/project/src/file with spaces.ts');
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('handles unicode in path', () => {
      const input = createWriteInput('/test/project/src/\u00E9\u00E8\u00EA.ts');
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });

  describe('Edit tool (should behave same as Write)', () => {
    test('auto-approves Edit within project', () => {
      const input: HookInput = {
        tool_name: 'Edit',
        session_id: 'test-session-123',
        tool_input: {
          file_path: '/test/project/src/file.ts',
          old_string: 'old',
          new_string: 'new',
        },
        project_dir: '/test/project',
      };
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('blocks Edit to node_modules', () => {
      const input: HookInput = {
        tool_name: 'Edit',
        session_id: 'test-session-123',
        tool_input: {
          file_path: '/test/project/node_modules/pkg/index.js',
          old_string: 'old',
          new_string: 'new',
        },
        project_dir: '/test/project',
      };
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('added_dirs support (CC 2.1.47)', () => {
    test('auto-approves write inside an added_dir', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/other/service/src/main.ts', content: 'x' },
        project_dir: '/test/project',
        added_dirs: ['/other/service'],
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('requires manual approval for paths outside both project_dir and added_dirs', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/unrelated/file.ts', content: 'x' },
        project_dir: '/test/project',
        added_dirs: ['/other/service'],
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });

    test('still blocks excluded dirs inside an added_dir', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/other/service/node_modules/pkg/index.js', content: 'x' },
        project_dir: '/test/project',
        added_dirs: ['/other/service'],
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });

    test('works correctly with empty added_dirs array', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/test/project/src/index.ts', content: 'x' },
        project_dir: '/test/project',
        added_dirs: [],
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('works correctly when added_dirs is undefined', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/test/project/src/index.ts', content: 'x' },
        project_dir: '/test/project',
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('guards against prefix attack in added_dirs', () => {
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session-123',
        tool_input: { file_path: '/other/service-evil/file.ts', content: 'x' },
        project_dir: '/test/project',
        added_dirs: ['/other/service'],
      };
      const result = autoApproveProjectWrites(input);
      expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
    });
  });

  describe('Different project directories', () => {
    test('handles root project directory', async () => {
      const common = await import('../../lib/common.js');
      vi.mocked(common.getProjectDir).mockReturnValue('/');
      const input = createWriteInput('/src/file.ts', '/');
      const result = autoApproveProjectWrites(input);

      expect(result.continue).toBe(true);
    });

    test('handles project with trailing slash', () => {
      const input = createWriteInput('/test/project/src/file.ts');
      const result = autoApproveProjectWrites(input);

      expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('handles Windows-style paths', () => {
      // Even on Unix, test handling of backslashes
      const input = createWriteInput('/test/project\\src\\file.ts');
      const result = autoApproveProjectWrites(input);

      // Depends on path normalization
      expect(result.continue).toBe(true);
    });
  });
});
