/**
 * Integration tests for hook execution chains
 * Tests how multiple hooks work together in realistic scenarios
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput, HookResult } from '../../types.js';

// Import hooks for integration testing
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';

// Mock common module for all hooks
vi.mock('../../lib/common.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn().mockReturnValue('/test/project'),
    getCachedBranch: vi.fn().mockReturnValue('main'),
  };
});

// Mock guards
vi.mock('../../lib/guards.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/guards.js')>('../../lib/guards.js');
  return {
    ...actual,
    guardCodeFiles: vi.fn().mockReturnValue(null),
    guardSkipInternal: vi.fn().mockReturnValue(null),
    runGuards: vi.fn().mockReturnValue(null),
  };
});

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('Hook Chain Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission Hook Chains', () => {
    describe('Bash Permission Flow', () => {
      test('safe git command flows through permission chain', () => {
        const input: HookInput = {
          tool_name: 'Bash',
          session_id: 'test-session',
          tool_input: { command: 'git status' },
          project_dir: '/test/project',
        };

        // Step 1: Permission hook evaluates command
        const permResult = autoApproveSafeBash(input);

        expect(permResult.continue).toBe(true);
        expect(permResult.hookSpecificOutput?.permissionDecision).toBe('allow');
      });

      test('dangerous command requires manual approval through chain', () => {
        const input: HookInput = {
          tool_name: 'Bash',
          session_id: 'test-session',
          tool_input: { command: 'rm -rf /' },
          project_dir: '/test/project',
        };

        const permResult = autoApproveSafeBash(input);

        expect(permResult.continue).toBe(true);
        // No auto-approval - requires user decision
        expect(permResult.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });

      test('chained git commands evaluated independently', () => {
        const commands = [
          'git status',
          'git diff',
          'git log --oneline -5',
        ];

        commands.forEach(cmd => {
          const input: HookInput = {
            tool_name: 'Bash',
            session_id: 'test-session',
            tool_input: { command: cmd },
            project_dir: '/test/project',
          };

          const result = autoApproveSafeBash(input);
          expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
        });
      });
    });

    describe('Write Permission Flow', () => {
      test('in-project write flows through permission chain', () => {
        const input: HookInput = {
          tool_name: 'Write',
          session_id: 'test-session',
          tool_input: {
            file_path: '/test/project/src/index.ts',
            content: 'export const x = 1;',
          },
          project_dir: '/test/project',
        };

        const permResult = autoApproveProjectWrites(input);

        expect(permResult.continue).toBe(true);
        expect(permResult.hookSpecificOutput?.permissionDecision).toBe('allow');
      });

      test('out-of-project write requires manual approval', () => {
        const input: HookInput = {
          tool_name: 'Write',
          session_id: 'test-session',
          tool_input: {
            file_path: '/etc/passwd',
            content: 'malicious',
          },
          project_dir: '/test/project',
        };

        const permResult = autoApproveProjectWrites(input);

        expect(permResult.continue).toBe(true);
        expect(permResult.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });

      test('excluded directory write requires manual approval', () => {
        const input: HookInput = {
          tool_name: 'Write',
          session_id: 'test-session',
          tool_input: {
            file_path: '/test/project/node_modules/pkg/index.js',
            content: 'patched',
          },
          project_dir: '/test/project',
        };

        const permResult = autoApproveProjectWrites(input);

        expect(permResult.continue).toBe(true);
        expect(permResult.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });
  });

  describe('Multi-Step Workflow Scenarios', () => {
    test('typical development workflow: read, modify, write', () => {
      // Step 1: User reads file (no permission needed for Read)
      const readInput: HookInput = {
        tool_name: 'Read',
        session_id: 'test-session',
        tool_input: { file_path: '/test/project/src/index.ts' },
        project_dir: '/test/project',
      };
      // Read doesn't go through permission hooks

      // Step 2: User writes modified file
      const writeInput: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session',
        tool_input: {
          file_path: '/test/project/src/index.ts',
          content: 'export const x = 2;',
        },
        project_dir: '/test/project',
      };

      const writeResult = autoApproveProjectWrites(writeInput);
      expect(writeResult.hookSpecificOutput?.permissionDecision).toBe('allow');

      // Step 3: User runs tests
      const testInput: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session',
        tool_input: { command: 'npm test' },
        project_dir: '/test/project',
      };

      const testResult = autoApproveSafeBash(testInput);
      expect(testResult.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('git workflow: status, diff, add, commit', () => {
      const gitCommands = [
        { cmd: 'git status', shouldAutoApprove: true },
        { cmd: 'git diff', shouldAutoApprove: true },
        { cmd: 'git add src/index.ts', shouldAutoApprove: false }, // Modifying operation
        { cmd: 'git commit -m "feat: update"', shouldAutoApprove: false }, // Modifying operation
      ];

      gitCommands.forEach(({ cmd, shouldAutoApprove }) => {
        const input: HookInput = {
          tool_name: 'Bash',
          session_id: 'test-session',
          tool_input: { command: cmd },
          project_dir: '/test/project',
        };

        const result = autoApproveSafeBash(input);

        if (shouldAutoApprove) {
          expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
        } else {
          expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
        }
      });
    });
  });

  describe('Error Propagation', () => {
    test('hook chain continues even when one hook returns warning', () => {
      // First hook passes with warning
      const input: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session',
        tool_input: {
          file_path: '/test/project/src/file.ts',
          content: 'const apiKey = "secret123";', // Security warning content
        },
        project_dir: '/test/project',
      };

      // Permission hook should still allow
      const permResult = autoApproveProjectWrites(input);
      expect(permResult.continue).toBe(true);
      expect(permResult.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('chain handles unexpected input gracefully', () => {
      const malformedInputs: HookInput[] = [
        {
          tool_name: 'Bash',
          session_id: 'test-session',
          tool_input: {}, // Missing command
          project_dir: '/test/project',
        },
        {
          tool_name: 'Write',
          session_id: 'test-session',
          tool_input: { content: 'test' }, // Missing file_path
          project_dir: '/test/project',
        },
      ];

      malformedInputs.forEach(input => {
        // Should not throw
        if (input.tool_name === 'Bash') {
          const result = autoApproveSafeBash(input);
          expect(result.continue).toBe(true);
        } else {
          const result = autoApproveProjectWrites(input);
          expect(result.continue).toBe(true);
        }
      });
    });
  });

  describe('Session Consistency', () => {
    test('same session_id gets consistent treatment', () => {
      const sessionId = 'consistent-session-123';

      // Multiple operations in same session
      const operations: HookInput[] = [
        {
          tool_name: 'Bash',
          session_id: sessionId,
          tool_input: { command: 'git status' },
          project_dir: '/test/project',
        },
        {
          tool_name: 'Write',
          session_id: sessionId,
          tool_input: {
            file_path: '/test/project/src/file.ts',
            content: 'test',
          },
          project_dir: '/test/project',
        },
        {
          tool_name: 'Bash',
          session_id: sessionId,
          tool_input: { command: 'npm test' },
          project_dir: '/test/project',
        },
      ];

      operations.forEach(input => {
        if (input.tool_name === 'Bash') {
          const result = autoApproveSafeBash(input);
          expect(result.continue).toBe(true);
          expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
        } else {
          const result = autoApproveProjectWrites(input);
          expect(result.continue).toBe(true);
          expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
        }
      });
    });
  });

  describe('Cross-Tool Interactions', () => {
    test('write then bash verification flow', () => {
      // Write a test file
      const writeInput: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session',
        tool_input: {
          file_path: '/test/project/src/__tests__/new.test.ts',
          content: 'test("works", () => expect(true).toBe(true));',
        },
        project_dir: '/test/project',
      };

      const writeResult = autoApproveProjectWrites(writeInput);
      expect(writeResult.hookSpecificOutput?.permissionDecision).toBe('allow');

      // Run the tests
      const testInput: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session',
        tool_input: { command: 'npm run test' },
        project_dir: '/test/project',
      };

      const testResult = autoApproveSafeBash(testInput);
      expect(testResult.hookSpecificOutput?.permissionDecision).toBe('allow');
    });

    test('bash then write flow (create directory then file)', () => {
      // Create directory (requires approval)
      const mkdirInput: HookInput = {
        tool_name: 'Bash',
        session_id: 'test-session',
        tool_input: { command: 'mkdir -p src/new-feature' },
        project_dir: '/test/project',
      };

      const mkdirResult = autoApproveSafeBash(mkdirInput);
      expect(mkdirResult.continue).toBe(true);
      // mkdir is not in safe patterns
      expect(mkdirResult.hookSpecificOutput?.permissionDecision).toBeUndefined();

      // Write file to new directory
      const writeInput: HookInput = {
        tool_name: 'Write',
        session_id: 'test-session',
        tool_input: {
          file_path: '/test/project/src/new-feature/index.ts',
          content: 'export const feature = true;',
        },
        project_dir: '/test/project',
      };

      const writeResult = autoApproveProjectWrites(writeInput);
      expect(writeResult.hookSpecificOutput?.permissionDecision).toBe('allow');
    });
  });
});

describe('Hook Result Structure Validation', () => {
  test('all hooks return valid HookResult structure', () => {
    const testCases: Array<{ hook: (input: HookInput) => HookResult; input: HookInput }> = [
      {
        hook: autoApproveSafeBash,
        input: {
          tool_name: 'Bash',
          session_id: 'test',
          tool_input: { command: 'ls' },
          project_dir: '/test/project',
        },
      },
      {
        hook: autoApproveProjectWrites,
        input: {
          tool_name: 'Write',
          session_id: 'test',
          tool_input: { file_path: '/test/project/file.ts', content: 'x' },
          project_dir: '/test/project',
        },
      },
    ];

    testCases.forEach(({ hook, input }) => {
      const result = hook(input);

      // Required field
      expect(typeof result.continue).toBe('boolean');

      // Optional fields should be correct types if present
      if (result.suppressOutput !== undefined) {
        expect(typeof result.suppressOutput).toBe('boolean');
      }
      if (result.systemMessage !== undefined) {
        expect(typeof result.systemMessage).toBe('string');
      }
      if (result.stopReason !== undefined) {
        expect(typeof result.stopReason).toBe('string');
      }
      if (result.hookSpecificOutput !== undefined) {
        expect(typeof result.hookSpecificOutput).toBe('object');
      }
    });
  });
});
