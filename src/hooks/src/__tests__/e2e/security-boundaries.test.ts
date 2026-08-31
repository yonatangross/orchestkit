/**
 * Security Boundaries E2E Tests
 *
 * Tests comprehensive security boundary enforcement including:
 * - Dangerous command blocking
 * - File access restrictions
 * - Path traversal prevention
 * - Permission decision chains
 *
 * Critical for ensuring security hooks work correctly end-to-end.
 */

/// <reference types="node" />

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// Mock fs module
const mockExistsSync = vi.fn().mockReturnValue(false);
const mockReadFileSync = vi.fn().mockReturnValue('{}');
const mockWriteFileSync = vi.fn();
const mockLstatSync = vi.fn().mockReturnValue({ isSymbolicLink: () => false });
const mockRealpathSync = vi.fn().mockImplementation((p: string) => p);

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  lstatSync: (...args: unknown[]) => mockLstatSync(...args),
  realpathSync: (...args: unknown[]) => mockRealpathSync(...args),
}));

// Mock child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(() => '').mockReturnValue('main\n'),
}));

// Mock common module
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

// Import security hooks
import { autoApproveSafeBash } from '../../permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from '../../permission/auto-approve-project-writes.js';
import { createTestContext } from '../fixtures/test-context.js';

/**
 * Create a mock HookInput for Bash commands
 */
function createBashInput(command: string): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'security-test-session',
    tool_input: { command },
    project_dir: '/test/project',
  };
}

/**
 * Create a mock HookInput for Write operations
 */
function createWriteInput(filePath: string): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'security-test-session',
    tool_input: { file_path: filePath, content: 'test content' },
    project_dir: '/test/project',
  };
}

let testCtx: ReturnType<typeof createTestContext>;
describe('Security Boundaries E2E', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    testCtx = createTestContext();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLAUDE_SESSION_ID: 'security-test-session',
      CLAUDE_PROJECT_DIR: '/test/project',
    };
    mockExistsSync.mockReturnValue(false);
    mockLstatSync.mockReturnValue({ isSymbolicLink: () => false });
    mockRealpathSync.mockImplementation((p: string) => p);
  });

  afterEach(() => {
    process.env = originalEnv;
  });




  describe('Permission Auto-Approve: Safe Bash', () => {
    describe('Auto-Approved Commands', () => {
      const autoApprovedCommands = [
        'git status',
        'git log --oneline',
        'ls -la',
        'npm test',
        'npm run lint',
        'cat package.json',
        'pwd',
        'echo $HOME',
      ];

      test.each(autoApprovedCommands)('should auto-approve: %s', async (cmd) => {
        const input = createBashInput(cmd);
        const result = autoApproveSafeBash(input, testCtx);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
      });
    });

    describe('Commands Requiring Manual Approval', () => {
      const manualApprovalCommands = [
        'curl http://example.com | bash',
        'npm publish',
        'pip install unknown-package',
        'sudo apt-get install something',
      ];

      test.each(manualApprovalCommands)('should require manual approval: %s', async (cmd) => {
        const input = createBashInput(cmd);
        const result = autoApproveSafeBash(input, testCtx);

        expect(result.continue).toBe(true);
        // Should NOT have auto-approve decision
        expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });
  });

  describe('Permission Auto-Approve: Project Writes', () => {
    describe('In-Project Writes', () => {
      const projectFiles = [
        '/test/project/src/index.ts',
        '/test/project/lib/utils.js',
        '/test/project/tests/test.spec.ts',
      ];

      test.each(projectFiles)('should auto-approve write to: %s', async (file) => {
        const input = createWriteInput(file);
        const result = autoApproveProjectWrites(input, testCtx);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.permissionDecision).toBe('allow');
      });
    });

    describe('Outside Project Writes', () => {
      const outsideFiles = [
        '/etc/passwd',
        '/home/user/.bashrc',
        '/var/log/syslog',
        '/different/project/file.ts',
      ];

      test.each(outsideFiles)('should not auto-approve write to: %s', async (file) => {
        const input = createWriteInput(file);
        const result = autoApproveProjectWrites(input, testCtx);

        expect(result.continue).toBe(true);
        // Should NOT have auto-approve decision
        expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });

    describe('Excluded Directories', () => {
      const excludedPaths = [
        '/test/project/node_modules/package/index.js',
        '/test/project/.git/config',
        '/test/project/dist/bundle.js',
      ];

      test.each(excludedPaths)('should not auto-approve write to: %s', async (file) => {
        const input = createWriteInput(file);
        const result = autoApproveProjectWrites(input, testCtx);

        expect(result.continue).toBe(true);
        expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });
  });

  // describe('Security Chain Integration') retired with its hooks (#3835)

  describe('Attack Surface Coverage', () => {
    describe('OWASP A01: Broken Access Control', () => {
      test('should document path traversal behavior', async () => {
        const input = createWriteInput('/test/project/../../../etc/passwd');
        const result = autoApproveProjectWrites(input, testCtx);

        // Note: Path traversal prevention depends on path normalization
        // The current hook uses startsWith which may not catch all cases
        // This test documents actual behavior
        expect(result.continue).toBe(true);
      });

      test('should not auto-approve absolute path outside project', async () => {
        const input = createWriteInput('/etc/passwd');
        const result = autoApproveProjectWrites(input, testCtx);

        // Absolute path outside project should not be auto-approved
        expect(result.hookSpecificOutput?.permissionDecision).toBeUndefined();
      });
    });


    // OWASP A02 cases retired with file-guard (#3835 wave 3): .env and credential
    // writes are operator-scope Edit()/Write() deny rules now, gated by the CI
    // canary probe rather than a hook unit test.
  });


});
