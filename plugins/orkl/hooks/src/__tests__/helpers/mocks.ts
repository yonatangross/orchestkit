/**
 * Shared Mock Helpers for Hook Tests
 *
 * Centralized mock definitions to reduce duplication across test files.
 * Import these in your test files to maintain consistency.
 */

import { vi, expect } from 'vitest';
import type { PathLike } from 'node:fs';
import type { HookInput, HookResult, HookEvent } from '../../types.js';

// =============================================================================
// Type Definitions
// =============================================================================

/** Type-safe path for fs mock implementations */
export type MockPath = PathLike | string;

/** Standard silent success result */
export const SILENT_SUCCESS: HookResult = {
  continue: true,
  suppressOutput: true,
};

// =============================================================================
// Common.js Mock Factory
// =============================================================================

/**
 * Creates a standard mock for ../../lib/common.js
 * Use with vi.mock('../../lib/common.js', () => createCommonMock())
 */
export function createCommonMock(overrides: Record<string, unknown> = {}) {
  return {
    logHook: vi.fn(),
    outputSilentSuccess: vi.fn(() => SILENT_SUCCESS),
    outputAllowWithContext: vi.fn((ctx: string) => ({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: ctx,
        permissionDecision: 'allow',
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
    outputWarning: vi.fn((msg: string) => ({
      continue: true,
      systemMessage: `\u26a0 ${msg}`,
    })),
    getField: vi.fn((input: Record<string, unknown>, path: string) => {
      const parts = path.split('.');
      let val: unknown = input;
      for (const p of parts) {
        if (val && typeof val === 'object') {
          val = (val as Record<string, unknown>)[p];
        } else {
          return undefined;
        }
      }
      return val;
    }),
    getProjectDir: vi.fn(() => '/test/project'),
    getLogDir: vi.fn(() => '/test/project/.claude/logs'),
    getSessionId: vi.fn(() => 'test-session-id'),
    ...overrides,
  };
}

// =============================================================================
// Node:fs Mock Factory
// =============================================================================

/**
 * Creates a standard mock for node:fs
 * Use with vi.mock('node:fs', () => createFsMock())
 */
export function createFsMock(overrides: Record<string, unknown> = {}) {
  return {
    existsSync: vi.fn((_path: MockPath) => false),
    readFileSync: vi.fn((_path: MockPath) => ''),
    writeFileSync: vi.fn((_path: MockPath, _data: string) => undefined),
    appendFileSync: vi.fn((_path: MockPath, _data: string) => undefined),
    mkdirSync: vi.fn((_path: MockPath) => undefined),
    statSync: vi.fn((_path: MockPath) => ({ size: 100 })),
    renameSync: vi.fn((_oldPath: MockPath, _newPath: MockPath) => undefined),
    unlinkSync: vi.fn((_path: MockPath) => undefined),
    readdirSync: vi.fn((_path: MockPath) => []),
    ...overrides,
  };
}

// =============================================================================
// Node:child_process Mock Factory
// =============================================================================

/**
 * Creates a standard mock for node:child_process
 * Use with vi.mock('node:child_process', () => createChildProcessMock())
 */
export function createChildProcessMock(overrides: Record<string, unknown> = {}) {
  return {
    execSync: vi.fn((_cmd: string) => ''),
    exec: vi.fn(),
    spawn: vi.fn(),
    ...overrides,
  };
}

// =============================================================================
// Node:path Mock Factory
// =============================================================================

/**
 * Creates a standard mock for node:path
 * Use with vi.mock('node:path', () => createPathMock())
 */
export function createPathMock(overrides: Record<string, unknown> = {}) {
  return {
    join: vi.fn((...args: string[]) => args.join('/')),
    basename: vi.fn((p: string) => p.split('/').pop() || ''),
    dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
    resolve: vi.fn((...args: string[]) => args.join('/')),
    extname: vi.fn((p: string) => {
      const lastDot = p.lastIndexOf('.');
      return lastDot > 0 ? p.slice(lastDot) : '';
    }),
    ...overrides,
  };
}

// =============================================================================
// Guards Mock Factory
// =============================================================================

/**
 * Creates a standard mock for ../../lib/guards.js
 * Use with vi.mock('../../lib/guards.js', () => createGuardsMock())
 */
export function createGuardsMock(overrides: Record<string, unknown> = {}) {
  return {
    guardCodeFiles: vi.fn(() => null),
    guardSkipInternal: vi.fn(() => null),
    runGuards: vi.fn(() => null),
    isDontAskMode: vi.fn(() => false),
    ...overrides,
  };
}

// =============================================================================
// Input Factory Functions
// =============================================================================

/**
 * Creates a standard HookInput for Bash tool tests
 */
export function createBashInput(
  command: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Bash',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { command },
    ...overrides,
  };
}

/**
 * Creates a standard HookInput for Write tool tests
 */
export function createWriteInput(
  filePath: string,
  content: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Write',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath, content },
    ...overrides,
  };
}

/**
 * Creates a standard HookInput for Read tool tests
 */
export function createReadInput(
  filePath: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Read',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { file_path: filePath },
    ...overrides,
  };
}

/**
 * Creates a standard HookInput for Task tool tests
 */
export function createTaskInput(
  subagentType: string,
  prompt: string,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    tool_name: 'Task',
    session_id: 'test-session-123',
    project_dir: '/test/project',
    tool_input: { subagent_type: subagentType, prompt },
    ...overrides,
  };
}

/**
 * Creates a standard HookInput for Stop hook tests
 */
export function createStopInput(
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    hook_event: 'Stop',
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
    ...overrides,
  };
}

/**
 * Creates a standard HookInput for lifecycle hook tests
 */
export function createLifecycleInput(
  hookEvent: HookEvent,
  overrides: Partial<HookInput> = {}
): HookInput {
  return {
    hook_event: hookEvent,
    tool_name: '',
    session_id: 'test-session-001',
    tool_input: {},
    ...overrides,
  };
}

// =============================================================================
// Async Test Helpers
// =============================================================================

/**
 * Helper for testing async hook rejection
 */
export async function expectAsyncToNotThrow(
  asyncFn: () => Promise<unknown>
): Promise<void> {
  await expect(asyncFn()).resolves.not.toThrow();
}

/**
 * Helper for testing that a hook returns silent success even on error
 */
export function expectSilentSuccess(result: HookResult): void {
  expect(result.continue).toBe(true);
  expect(result.suppressOutput).toBe(true);
}

/**
 * Helper for testing that a hook allows with context
 */
export function expectAllowWithContext(
  result: HookResult,
  contextSubstring: string
): void {
  expect(result.continue).toBe(true);
  expect(result.hookSpecificOutput?.additionalContext).toContain(contextSubstring);
}

/**
 * Helper for testing that a hook blocks execution
 */
export function expectBlocked(
  result: HookResult,
  reasonSubstring?: string
): void {
  expect(result.continue).toBe(false);
  if (reasonSubstring) {
    expect(result.stopReason).toContain(reasonSubstring);
  }
}
