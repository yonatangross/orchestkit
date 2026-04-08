/**
 * Test context factory — creates HookContext with vi.fn() stubs.
 * Use instead of vi.mock for any hook that accepts (input, ctx).
 *
 * Usage:
 *   import { createTestContext } from '../fixtures/test-context.js';
 *   const ctx = createTestContext();
 *   const result = myHook(input, ctx);
 *   expect(ctx.log).toHaveBeenCalledWith('myHook', 'msg');
 */

import { vi } from 'vitest';
import type { HookContext } from '../../types.js';

/**
 * Create a test HookContext with sensible defaults.
 * Override any field: createTestContext({ projectDir: '/custom' })
 */
export function createTestContext(overrides: Partial<HookContext> = {}): HookContext {
  return {
    projectDir: '/test/project',
    logDir: '/test/logs',
    pluginRoot: '/test/plugin-root',
    pluginDataDir: null,
    sessionId: 'test-session-123',
    branch: 'main',
    logLevel: 'warn',
    log: vi.fn(),
    logPermission: vi.fn(),
    writeRules: vi.fn(() => true),
    shouldLog: vi.fn(() => false),
    ...overrides,
  };
}
