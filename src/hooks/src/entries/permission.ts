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

// Import PermissionRequest hook implementations
import { autoApproveSafeBash } from '../permission/auto-approve-safe-bash.js';
import { autoApproveProjectWrites } from '../permission/auto-approve-project-writes.js';
import { learningTracker } from '../permission/learning-tracker.js';
import { unifiedPermissionBashDispatcher } from '../permission/unified-dispatcher.js';
import { headlessDefer } from '../permission/headless-defer.js';

// Import PermissionDenied hook implementations (CC 2.1.88)
import { unifiedPermissionDeniedDispatcher } from '../permission-denied/unified-dispatcher.js';
import { safeCommandRetry } from '../permission-denied/safe-command-retry.js';
import { projectWriteRetry } from '../permission-denied/project-write-retry.js';
import { denialLogger } from '../permission-denied/denial-logger.js';
import { denialNotification } from '../permission-denied/denial-notification.js';

import type { HookFn } from '../types.js';

/**
 * Permission hooks registry (PermissionRequest + PermissionDenied)
 */
export const hooks: Record<string, HookFn> = {
  'permission/auto-approve-safe-bash': autoApproveSafeBash,
  'permission/auto-approve-project-writes': autoApproveProjectWrites,
  'permission/learning-tracker': learningTracker,
  'permission/unified-dispatcher': unifiedPermissionBashDispatcher,
  'permission/headless-defer': headlessDefer,
  // PermissionDenied (CC 2.1.88)
  'permission-denied/unified-dispatcher': unifiedPermissionDeniedDispatcher,
  'permission-denied/safe-command-retry': safeCommandRetry,
  'permission-denied/project-write-retry': projectWriteRetry,
  'permission-denied/denial-logger': denialLogger,
  'permission-denied/denial-notification': denialNotification,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';
