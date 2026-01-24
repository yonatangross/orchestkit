/**
 * Permission Hooks Entry Point
 *
 * Hooks that handle permission decisions (PreToolUse with permissionDecision)
 * Bundle: permission.mjs (~15 KB estimated)
 */

// Re-export types and utilities needed by permission hooks
export * from '../types.js';
export * from '../lib/common.js';
export * from '../lib/guards.js';

// Import hook implementations
import { autoApproveSafeBash } from '../permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from '../permission/auto-approve-project-writes.js';
import { learningTracker } from '../permission/learning-tracker.js';

import type { HookFn } from '../types.js';

/**
 * Permission hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'permission/auto-approve-safe-bash': autoApproveSafeBash,
  'permission/auto-approve-project-writes': autoApproveProjectWrites,
  'permission/learning-tracker': learningTracker,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
