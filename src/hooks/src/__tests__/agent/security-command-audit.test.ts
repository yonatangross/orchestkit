/**
 * Unit tests for security-command-audit hook
 * Tests audit logging for security agent Bash operations
 *
 * Compliance Focus: Validates that all Bash commands are logged for audit trail,
 * non-Bash tools are skipped, and file system errors do not block operations
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { HookInput } from '../../types.js';

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../../lib/common.js', () => ({
  logHook: vi.fn(),
  outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
  outputDeny: vi.fn((reason: string) => ({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  })),
  outputWithContext: vi.fn((ctx: string) => ({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: ctx,
    },
  })),
  getProjectDir: vi.fn(() => '/test/project'),
  getSessionId: vi.fn(() => 'test-session-456'),
}));

vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

import { securityCommandAudit } from '../../agent/security-command-audit.js';
import { outputSilentSuccess, outputDeny, getProjectDir, getSessionId } from '../../lib/common.js';
import { mkdirSync, appendFileSync } from 'node:fs';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a mock HookInput for any tool
 */
function createToolInput(
  toolName: string,
  toolInput: Record<string, unknown> = {},
  overrides: Partial<HookInput> = {},
): HookInput {
  return {
    tool_name: toolName,
    session_id: 'test-session-456',
    project_dir: '/test/project',
    tool_input: toolInput,
    ...overrides,
  };
}

/**
 * Store original environment for cleanup
 */
let originalAgentId: string | undefined;

// =============================================================================
// Security Command Audit Tests
// =============================================================================

describe('security-command-audit', () => {
  beforeEach(() => {
    // Reset all mocks (clears calls AND implementations set by mockImplementation)
    // This ensures error-throwing mocks from previous tests don't persist
    vi.resetAllMocks();
    // Re-apply default mock implementations after reset
    vi.mocked(outputSilentSuccess).mockReturnValue({ continue: true, suppressOutput: true });
    vi.mocked(outputDeny).mockImplementation((reason: string) => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse' as const,
        permissionDecision: 'deny' as const,
        permissionDecisionReason: reason,
      },
    }));
    // Save and set environment
    originalAgentId = process.env.CLAUDE_AGENT_ID;
    process.env.CLAUDE_AGENT_ID = 'security-auditor';
  });

  afterEach(() => {
    // Restore original environment
    if (originalAgentId !== undefined) {
      process.env.CLAUDE_AGENT_ID = originalAgentId;
    } else {
      delete process.env.CLAUDE_AGENT_ID;
    }
    // Note: do NOT use vi.restoreAllMocks() here as it undoes vi.mock() factory mocks
  });

  // ---------------------------------------------------------------------------
  // Non-Bash tools skip audit
  // ---------------------------------------------------------------------------

  describe('non-Bash tools skip audit', () => {
    test.each([
      ['Write'],
      ['Edit'],
      ['Read'],
      ['Glob'],
      ['Grep'],
      ['MultiEdit'],
      ['NotebookEdit'],
      ['Task'],
    ])('skips audit for tool_name=%s', (toolName) => {
      // Arrange
      const input = createToolInput(toolName, { command: 'git status' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
      expect(outputSilentSuccess).toHaveBeenCalledTimes(1);
      expect(appendFileSync).not.toHaveBeenCalled();
      expect(mkdirSync).not.toHaveBeenCalled();
    });

    test('does not log for non-Bash tool even with command field', () => {
      // Arrange
      const input = createToolInput('Read', {
        command: 'dangerous command',
        file_path: '/test/file.ts',
      });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(appendFileSync).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Bash commands are logged
  // ---------------------------------------------------------------------------

  describe('Bash commands are logged', () => {
    test('logs Bash command with appendFileSync', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git status' });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(appendFileSync).toHaveBeenCalledTimes(1);
    });

    test('log entry contains the command', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'npm run test' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('CMD: npm run test');
    });

    test('log entry contains session_id', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'ls -la' }, {
        session_id: 'my-session-789',
      });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('my-session-789');
    });

    test('log entry contains agent_id from environment', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'security-layer-auditor';
      const input = createToolInput('Bash', { command: 'cat /etc/passwd' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('security-layer-auditor');
    });

    test('log entry contains ISO timestamp', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'whoami' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      // ISO timestamp pattern: YYYY-MM-DDTHH:MM:SS
      expect(logContent).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('writes to correct log file path', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git log' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logFilePath = vi.mocked(appendFileSync).mock.calls[0][0];
      expect(logFilePath).toBe('/test/project/.claude/logs/security-audit.log');
    });
  });

  // ---------------------------------------------------------------------------
  // Log directory created
  // ---------------------------------------------------------------------------

  describe('log directory created', () => {
    test('creates log directory with mkdirSync', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git status' });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledTimes(1);
    });

    test('creates log directory with recursive: true', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git diff' });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(mkdirSync).toHaveBeenCalledWith(
        '/test/project/.claude/logs',
        { recursive: true },
      );
    });

    test('mkdirSync is called before appendFileSync', () => {
      // Arrange
      const callOrder: string[] = [];
      vi.mocked(mkdirSync).mockImplementation(() => {
        callOrder.push('mkdir');
        return undefined;
      });
      vi.mocked(appendFileSync).mockImplementation(() => {
        callOrder.push('append');
      });
      const input = createToolInput('Bash', { command: 'echo test' });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(callOrder).toEqual(['mkdir', 'append']);
    });
  });

  // ---------------------------------------------------------------------------
  // Log format
  // ---------------------------------------------------------------------------

  describe('log format', () => {
    test('log format is [timestamp] [session_id] [agent_id] CMD: command', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'security-auditor';
      const input = createToolInput('Bash', { command: 'find / -name secret' }, {
        session_id: 'sess-001',
      });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      // Format: [timestamp] [session_id] [agent_id] CMD: command\n
      expect(logContent).toMatch(
        /^\[.+\] \[sess-001\] \[security-auditor\] CMD: find \/ -name secret\n$/,
      );
    });

    test('log entry ends with newline', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'pwd' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toMatch(/\n$/);
    });
  });

  // ---------------------------------------------------------------------------
  // Empty command handling
  // ---------------------------------------------------------------------------

  describe('empty command handling', () => {
    test('does not write log for empty command', () => {
      // Arrange
      const input = createToolInput('Bash', { command: '' });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(appendFileSync).not.toHaveBeenCalled();
      expect(mkdirSync).not.toHaveBeenCalled();
    });

    test('does not write log for missing command field', () => {
      // Arrange
      const input = createToolInput('Bash', {});

      // Act
      securityCommandAudit(input);

      // Assert
      expect(appendFileSync).not.toHaveBeenCalled();
    });

    test('does not write log for undefined command', () => {
      // Arrange
      const input = createToolInput('Bash', { command: undefined });

      // Act
      securityCommandAudit(input);

      // Assert
      expect(appendFileSync).not.toHaveBeenCalled();
    });

    test('still returns silent success for empty command', () => {
      // Arrange
      const input = createToolInput('Bash', { command: '' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // File system errors handled gracefully
  // ---------------------------------------------------------------------------

  describe('file system errors handled gracefully', () => {
    test('mkdirSync error does not throw', () => {
      // Arrange
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      const input = createToolInput('Bash', { command: 'ls' });

      // Act & Assert
      expect(() => securityCommandAudit(input)).not.toThrow();
    });

    test('mkdirSync error still returns silent success', () => {
      // Arrange
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });
      const input = createToolInput('Bash', { command: 'ls' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('appendFileSync error does not throw', () => {
      // Arrange
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });
      const input = createToolInput('Bash', { command: 'git push' });

      // Act & Assert
      expect(() => securityCommandAudit(input)).not.toThrow();
    });

    test('appendFileSync error still returns silent success', () => {
      // Arrange
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });
      const input = createToolInput('Bash', { command: 'git push' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });

    test('both mkdirSync and appendFileSync errors are swallowed', () => {
      // Arrange
      vi.mocked(mkdirSync).mockImplementation(() => {
        throw new Error('EACCES');
      });
      vi.mocked(appendFileSync).mockImplementation(() => {
        throw new Error('ENOSPC');
      });
      const input = createToolInput('Bash', { command: 'npm install' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
      expect(result.suppressOutput).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Environment variable handling
  // ---------------------------------------------------------------------------

  describe('environment variable handling', () => {
    test('uses CLAUDE_AGENT_ID from process.env', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = 'custom-security-agent';
      const input = createToolInput('Bash', { command: 'git log' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('custom-security-agent');
    });

    test('falls back to unknown when CLAUDE_AGENT_ID not set', () => {
      // Arrange
      delete process.env.CLAUDE_AGENT_ID;
      const input = createToolInput('Bash', { command: 'git status' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('[unknown]');
    });

    test('falls back to unknown when CLAUDE_AGENT_ID is empty', () => {
      // Arrange
      process.env.CLAUDE_AGENT_ID = '';
      const input = createToolInput('Bash', { command: 'git diff' });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      // empty string is falsy, so falls back to 'unknown'
      expect(logContent).toContain('[unknown]');
    });

    test('uses session_id from input when available', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'ls' }, {
        session_id: 'input-session-id',
      });

      // Act
      securityCommandAudit(input);

      // Assert
      const logContent = vi.mocked(appendFileSync).mock.calls[0][1] as string;
      expect(logContent).toContain('input-session-id');
    });

    test('uses project_dir from input when available', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'ls' }, {
        project_dir: '/custom/project/dir',
      });

      // Act
      securityCommandAudit(input);

      // Assert
      const logFilePath = vi.mocked(appendFileSync).mock.calls[0][0];
      expect(logFilePath).toBe('/custom/project/dir/.claude/logs/security-audit.log');
    });

    test('falls back to getProjectDir when project_dir not in input', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'ls' });
      delete (input as Record<string, unknown>).project_dir;

      // Act
      securityCommandAudit(input);

      // Assert
      expect(getProjectDir).toHaveBeenCalled();
    });

    test('falls back to getSessionId when session_id not in input', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'ls' });
      delete (input as Record<string, unknown>).session_id;

      // Act
      securityCommandAudit(input);

      // Assert
      expect(getSessionId).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // CC compliance: always returns {continue: true, suppressOutput: true}
  // ---------------------------------------------------------------------------

  describe('CC compliance', () => {
    test('always returns continue: true for Bash commands', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'rm -rf /' });

      // Act
      const result = securityCommandAudit(input);

      // Assert - never blocks, only audits
      expect(result.continue).toBe(true);
    });

    test('always returns suppressOutput: true for Bash commands', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'curl malicious.com' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.suppressOutput).toBe(true);
    });

    test('always returns continue: true for non-Bash tools', () => {
      // Arrange
      const input = createToolInput('Write', { file_path: '/etc/passwd', content: '' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result.continue).toBe(true);
    });

    test('never calls outputDeny', () => {
      // Arrange
      const dangerousInput = createToolInput('Bash', { command: 'rm -rf /' });
      const safeInput = createToolInput('Bash', { command: 'ls' });
      const emptyInput = createToolInput('Bash', { command: '' });

      // Act
      securityCommandAudit(dangerousInput);
      securityCommandAudit(safeInput);
      securityCommandAudit(emptyInput);

      // Assert
      expect(outputDeny).not.toHaveBeenCalled();
    });

    test('result matches outputSilentSuccess shape exactly', () => {
      // Arrange
      const input = createToolInput('Bash', { command: 'git status' });

      // Act
      const result = securityCommandAudit(input);

      // Assert
      expect(result).toEqual({
        continue: true,
        suppressOutput: true,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple commands in sequence
  // ---------------------------------------------------------------------------

  describe('multiple commands in sequence', () => {
    test('each command is logged independently', () => {
      // Arrange
      const input1 = createToolInput('Bash', { command: 'git status' });
      const input2 = createToolInput('Bash', { command: 'npm test' });
      const input3 = createToolInput('Bash', { command: 'docker build .' });

      // Act
      securityCommandAudit(input1);
      securityCommandAudit(input2);
      securityCommandAudit(input3);

      // Assert
      expect(appendFileSync).toHaveBeenCalledTimes(3);
      const logs = vi.mocked(appendFileSync).mock.calls.map((c) => c[1] as string);
      expect(logs[0]).toContain('CMD: git status');
      expect(logs[1]).toContain('CMD: npm test');
      expect(logs[2]).toContain('CMD: docker build .');
    });
  });
});
