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

// Agent hooks (6)
import { a11yLintCheck } from '../agent/a11y-lint-check.js';
import { blockWrites } from '../agent/block-writes.js';
import { ciSafetyCheck } from '../agent/ci-safety-check.js';
import { deploymentSafetyCheck } from '../agent/deployment-safety-check.js';
import { migrationSafetyCheck } from '../agent/migration-safety-check.js';
import { securityCommandAudit } from '../agent/security-command-audit.js';

import type { HookFn } from '../types.js';

/**
 * Agent hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'agent/a11y-lint-check': a11yLintCheck,
  'agent/block-writes': blockWrites,
  'agent/ci-safety-check': ciSafetyCheck,
  'agent/deployment-safety-check': deploymentSafetyCheck,
  'agent/migration-safety-check': migrationSafetyCheck,
  'agent/security-command-audit': securityCommandAudit,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
