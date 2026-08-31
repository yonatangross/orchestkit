/**
 * Agent Hooks Entry Point
 *
 * Hooks that are agent-specific (safety checks, validation)
 * Bundle: agent.mjs (~15 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/guards.js';

// Agent hooks (2). The four deleted 2026-08-31 (#3835 purge wave 1:
// block-writes, ci-safety-check, deployment-safety-check,
// migration-safety-check) were dead since #3461: reachable only through
// agent-frontmatter `hooks:`, which CC ignores.
import { securityCommandAudit } from '../agent/security-command-audit.js';

import type { HookFn } from '../types.js';

/**
 * Agent hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'agent/security-command-audit': securityCommandAudit,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';
