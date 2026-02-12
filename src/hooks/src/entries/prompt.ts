/**
 * Prompt Hooks Entry Point
 *
 * Hooks that run on user prompt submission (UserPromptSubmit)
 * Bundle: prompt.mjs
 *
 * Issue #448: Consolidated 9 every-turn hooks into unified-dispatcher.
 * Remaining separate entries: 3 once-only + 1 background + 1 dispatcher.
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Re-export orchestration modules needed by prompt hooks
export * from '../lib/orchestration-types.js';
export * from '../lib/intent-classifier.js';
export * from '../lib/orchestration-state.js';
export * from '../lib/task-integration.js';
export * from '../lib/retry-manager.js';
export * from '../lib/calibration-engine.js';
export * from '../lib/multi-agent-coordinator.js';

// --- Individual hooks still registered separately in hooks.json ---

// Once-only hooks (once: true)
import { profileInjector } from '../prompt/profile-injector.js';
import { memoryContextLoader } from '../prompt/memory-context-loader.js';

// Background hook (uses run-hook-silent.mjs)
import { captureUserIntent } from '../prompt/capture-user-intent.js';

// --- Unified dispatcher (Issue #448) ---
// Consolidates: context-injector, todo-enforcer, satisfaction-detector,
// communication-style-tracker, antipattern-detector, antipattern-warning,
// memory-context, context-pruning-advisor, pipeline-detector
import { unifiedPromptDispatcher } from '../prompt/unified-dispatcher.js';

// --- Legacy hooks kept in bundle for backward compat (not in hooks.json) ---
import { antipatternDetector } from '../prompt/antipattern-detector.js';
import { antipatternWarning } from '../prompt/antipattern-warning.js';
import { contextInjector } from '../prompt/context-injector.js';
import { contextPruningAdvisor } from '../prompt/context-pruning-advisor.js';
import { memoryContext } from '../prompt/memory-context.js';
import { satisfactionDetector } from '../prompt/satisfaction-detector.js';
import { todoEnforcer } from '../prompt/todo-enforcer.js';
import { pipelineDetector } from '../prompt/pipeline-detector.js';
import { communicationStyleTracker } from '../prompt/communication-style-tracker.js';

import type { HookFn } from '../types.js';

/**
 * Prompt hooks registry
 *
 * Issue #448: Only 5 hooks are registered in hooks.json now.
 * The remaining 9 are consolidated into unified-dispatcher.
 * Legacy entries kept for backward compat if users reference them in overrides.
 */
export const hooks: Record<string, HookFn> = {
  // Active hooks (registered in hooks.json)
  'prompt/unified-dispatcher': unifiedPromptDispatcher,
  'prompt/profile-injector': profileInjector,
  'prompt/memory-context-loader': memoryContextLoader,
  'prompt/capture-user-intent': captureUserIntent,
  // Legacy hooks (consolidated into unified-dispatcher, kept for override compat)
  'prompt/antipattern-detector': antipatternDetector,
  'prompt/antipattern-warning': antipatternWarning,
  'prompt/context-injector': contextInjector,
  'prompt/context-pruning-advisor': contextPruningAdvisor,
  'prompt/memory-context': memoryContext,
  'prompt/satisfaction-detector': satisfactionDetector,
  'prompt/todo-enforcer': todoEnforcer,
  'prompt/pipeline-detector': pipelineDetector,
  'prompt/communication-style-tracker': communicationStyleTracker,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
