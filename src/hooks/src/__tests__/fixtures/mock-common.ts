/**
 * Canonical mock factories for common.js
 *
 * TWO MODES:
 *
 * 1. mockCommonReal() — PREFERRED. Spreads the real common.js module, only
 *    stubs side-effectful functions (I/O, logging, env). All output helpers
 *    (outputPromptContext, outputBlock, etc.) use their REAL implementations,
 *    so return shapes can never drift.
 *
 *    vi.mock('../../lib/common.js', async () => mockCommonReal());
 *
 * 2. mockCommonBasic() — Full replacement. Every function is a vi.fn() stub.
 *    Use when your test also mocks node:fs AND needs to control return values.
 *
 *    vi.mock('../../lib/common.js', () => mockCommonBasic());
 *
 * Both factories are type-safe against the real common.js exports. If common.ts
 * adds or removes a function, TypeScript will catch the mismatch (requires
 * tsconfig.test.json which includes test files).
 */

import { vi } from 'vitest';
import type { HookResult, HookInput } from '../../types.js';

// =============================================================================
// TYPE SAFETY: Import the real module type so our mocks stay in sync
// =============================================================================
type CommonModule = typeof import('../../lib/common.js');

/**
 * The side-effectful functions that MUST be stubbed in tests.
 * Everything else can use the real implementation safely.
 */
const SIDE_EFFECT_STUBS = {
  // I/O: logging writes to disk
  logHook: vi.fn(),
  logPermissionFeedback: vi.fn(),
  // I/O: rules file writes to disk
  writeRulesFile: vi.fn(() => true),
  // I/O: reads stdin
  readHookInput: vi.fn((): HookInput => ({ tool_name: '', session_id: 'test-session-123', tool_input: {} })),
  // Environment: reads cwd, env vars, git
  getProjectDir: vi.fn(() => '/test/project'),
  getPluginRoot: vi.fn(() => '/test/plugin-root'),
  getLogDir: vi.fn(() => '/test/logs'),
  getPluginDataDir: vi.fn(() => null),
  getSessionId: vi.fn(() => 'test-session-123'),
  getEnvFile: vi.fn(() => '/test/plugin-root/.claude/.instance_env'),
  getCachedBranch: vi.fn(() => 'main'),
  // Process: calls process.exit — NEVER run in tests
  outputStderrWarning: vi.fn(() => { throw new Error('outputStderrWarning calls process.exit — do not use in tests'); }) as unknown as (...args: unknown[]) => never,
  // Log level: stub to suppress output
  getLogLevel: vi.fn(() => 'warn'),
  shouldLog: vi.fn(() => false),
} as const;

// =============================================================================
// MODE 1: Real implementations + stubbed side effects (PREFERRED)
// =============================================================================

/**
 * Spreads the REAL common.js module, only replacing side-effectful functions.
 * Output helpers (outputPromptContext, outputBlock, etc.) are REAL — their
 * return shapes are always correct by construction.
 *
 * Usage:
 *   vi.mock('../../lib/common.js', async () => mockCommonReal());
 *   // or with overrides:
 *   vi.mock('../../lib/common.js', async () => mockCommonReal({ getProjectDir: vi.fn(() => '/custom') }));
 */
export async function mockCommonReal(
  overrides: Partial<Record<keyof CommonModule, unknown>> = {},
) {
  const actual = await vi.importActual<CommonModule>('../../lib/common.js');
  return {
    ...actual,
    ...SIDE_EFFECT_STUBS,
    ...overrides,
  };
}

// Backward-compat alias
export const mockCommonWithActual = mockCommonReal;

// =============================================================================
// MODE 2: Full replacement (all vi.fn stubs)
// =============================================================================

/**
 * Full replacement mock — every function is a vi.fn() with correct return shapes.
 * Use when you need total control (e.g., making outputSilentSuccess return custom values).
 *
 * Usage:
 *   vi.mock('../../lib/common.js', () => mockCommonBasic());
 */
export function mockCommonBasic(
  overrides: Partial<Record<keyof CommonModule, unknown>> = {},
) {
  return {
    // --- Side effects (same stubs as mockCommonReal) ---
    ...SIDE_EFFECT_STUBS,

    // --- Output helpers (correct return shapes, matching common.ts) ---
    outputSilentSuccess: vi.fn((): HookResult => ({ continue: true, suppressOutput: true })),
    outputSilentAllow: vi.fn((): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { permissionDecision: 'allow' },
    })),
    outputBlock: vi.fn((reason: string): HookResult => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: reason },
    })),
    outputWithContext: vi.fn((ctx: string): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx },
    })),
    outputPromptContext: vi.fn((ctx: string): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
    })),
    outputWithNotification: vi.fn((userMessage: string | undefined, claudeContext: string | undefined): HookResult => {
      const result: HookResult = { continue: true, suppressOutput: true };
      if (userMessage) result.systemMessage = userMessage;
      if (claudeContext) result.hookSpecificOutput = { hookEventName: 'UserPromptSubmit', additionalContext: claudeContext };
      return result;
    }),
    outputDefer: vi.fn((reason: string): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'defer',
        permissionDecisionReason: reason,
      },
    })),
    outputAllowWithContext: vi.fn((ctx: string, systemMessage?: string): HookResult => {
      const result: HookResult = {
        continue: true,
        hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: ctx, permissionDecision: 'allow' },
      };
      if (systemMessage) result.systemMessage = systemMessage;
      else result.suppressOutput = true;
      return result;
    }),
    outputError: vi.fn((message: string): HookResult => ({ continue: true, systemMessage: message })),
    outputWarning: vi.fn((message: string): HookResult => ({ continue: true, systemMessage: `\u26a0 ${message}` })),
    outputDeny: vi.fn((reason: string): HookResult => ({
      continue: false,
      stopReason: reason,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
    })),
    outputAsk: vi.fn((reason: string): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
    })),
    outputWithUpdatedInput: vi.fn((updatedInput: Record<string, unknown>): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput },
    })),
    outputPromptContextBudgeted: vi.fn((ctx: string): HookResult => ({
      continue: true,
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx },
    })),

    // --- Pure utility functions (real logic, no I/O) ---
    extractContext: vi.fn((result: HookResult) => {
      if (result.hookSpecificOutput?.additionalContext) return result.hookSpecificOutput.additionalContext as string;
      if (result.systemMessage) return result.systemMessage;
      return null;
    }),
    estimateTokenCount: vi.fn((content: string) => Math.ceil(content.length / 3.5)),
    getField: vi.fn((input: HookInput, path: string) => {
      const parts = path.replace(/^\./, '').split('.');
      let value: unknown = input;
      for (const part of parts) {
        if (value === null || value === undefined) return undefined;
        value = (value as Record<string, unknown>)[part];
      }
      return value;
    }),
    normalizeCommand: vi.fn((cmd: string) => cmd.replace(/\\\s*[\r\n]+/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()),
    normalizeLineEndings: vi.fn((content: string) => content.replace(/\r\n/g, '\n')),
    escapeRegex: vi.fn((str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    lineContainsAll: vi.fn((content: string, ...terms: string[]) => content.split('\n').some((line: string) => terms.every(t => line.includes(t)))),
    lineContainsAllCI: vi.fn((content: string, ...terms: string[]) => content.split('\n').some((line: string) => { const lower = line.toLowerCase(); return terms.every(t => lower.includes(t.toLowerCase())); })),
    fnv1aHash: vi.fn(() => '00000000'),

    // --- Overrides ---
    ...overrides,
  };
}
