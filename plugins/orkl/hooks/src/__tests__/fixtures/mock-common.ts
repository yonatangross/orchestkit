/**
 * Shared mock factories for common.js
 *
 * Usage (unit tests that also mock node:fs):
 *   vi.mock('../../lib/common.js', () => mockCommonBasic());
 *
 * Usage (integration/e2e tests that need actual implementations):
 *   vi.mock('../../lib/common.js', async () => mockCommonWithActual());
 *
 * Both factories return an object compatible with the full common.js API.
 * Override individual functions after mock creation as needed:
 *   const { logHook } = await import('../../lib/common.js');
 *   vi.mocked(logHook).mockImplementation(() => { ... });
 */

import { vi } from 'vitest';

/**
 * Full replacement mock — no actual implementations imported.
 * Use when your test also mocks `node:fs` (avoids real I/O entirely).
 */
export function mockCommonBasic() {
  return {
    // Environment and Paths
    getProjectDir: vi.fn(() => '/test/project'),
    getPluginRoot: vi.fn(() => '/test/plugin-root'),
    getLogDir: vi.fn(() => '/test/logs'),
    getSessionId: vi.fn(() => 'test-session-123'),
    getEnvFile: vi.fn(() => '/test/plugin-root/.claude/.instance_env'),
    getCachedBranch: vi.fn(() => 'main'),

    // Output Helpers
    outputSilentSuccess: vi.fn(() => ({ continue: true, suppressOutput: true })),
    outputSilentAllow: vi.fn(() => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { permissionDecision: 'allow' },
    })),
    outputBlock: vi.fn((reason: string) => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: reason },
    })),
    outputWithContext: vi.fn((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx },
    })),
    outputPromptContext: vi.fn((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
    })),
    outputAllowWithContext: vi.fn((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ctx, permissionDecision: 'allow' },
    })),
    outputError: vi.fn((message: string) => ({ continue: true, systemMessage: message })),
    outputWarning: vi.fn((message: string) => ({ continue: true, systemMessage: `\u26a0 ${message}` })),
    outputDeny: vi.fn((reason: string) => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    })),
    outputWithUpdatedInput: vi.fn((updatedInput: Record<string, unknown>) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput },
    })),
    outputPromptContextBudgeted: vi.fn((ctx: string) => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
    })),

    // Logging
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),

    // Utilities
    estimateTokenCount: vi.fn((content: string) => Math.ceil(content.length / 3.5)),
    readHookInput: vi.fn(() => ({ tool_name: '', session_id: 'test-session-123', tool_input: {} })),
    getField: vi.fn(() => undefined),
    normalizeCommand: vi.fn((cmd: string) => cmd.replace(/\s+/g, ' ').trim()),
    escapeRegex: vi.fn((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),

    // Log level
    getLogLevel: vi.fn(() => 'warn'),
    shouldLog: vi.fn(() => false),
  };
}

/**
 * Spread of actual implementations + selective overrides.
 * Use for integration/e2e tests that need real logic but must suppress I/O.
 */
export async function mockCommonWithActual(
  overrides: Record<string, unknown> = {},
) {
  const actual = await vi.importActual<typeof import('../../lib/common.js')>('../../lib/common.js');
  return {
    ...actual,
    logHook: vi.fn(),
    logPermissionFeedback: vi.fn(),
    getProjectDir: vi.fn(() => '/test/project'),
    getPluginRoot: vi.fn(() => '/test/plugin-root'),
    getLogDir: vi.fn(() => '/test/logs'),
    getCachedBranch: vi.fn(() => 'main'),
    ...overrides,
  };
}
