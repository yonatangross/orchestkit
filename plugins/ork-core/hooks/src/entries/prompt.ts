/**
 * Prompt Hooks Entry Point
 *
 * Hooks that run on user prompt submission (UserPromptSubmit)
 * Bundle: prompt.mjs (~35 KB estimated)
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

// Prompt hooks (10) - UserPromptSubmit
import { antipatternDetector } from '../prompt/antipattern-detector.js';
import { antipatternWarning } from '../prompt/antipattern-warning.js';
import { contextInjector } from '../prompt/context-injector.js';
import { contextPruningAdvisor } from '../prompt/context-pruning-advisor.js';
import { memoryContext } from '../prompt/memory-context.js';
import { satisfactionDetector } from '../prompt/satisfaction-detector.js';
import { todoEnforcer } from '../prompt/todo-enforcer.js';
// Routing hooks removed — replaced by passive index (passive-index-migration)
import { pipelineDetector } from '../prompt/pipeline-detector.js';

// NOTE: skill-resolver removed - Claude Code natively auto-injects skills
// from agent frontmatter when agents are spawned via Task tool.
// See: docs/passive-index-migration.md

// Intelligent Decision Capture System (Issue #245)
import { captureUserIntent } from '../prompt/capture-user-intent.js';

// Memory Context Loader (Issue #245 - session-start memory loading)
import { memoryContextLoader } from '../prompt/memory-context-loader.js';

// Profile Injection (Issue #245 Phase 6.1)
import { profileInjector } from '../prompt/profile-injector.js';

// Communication Style Tracker (Issue #245 Phase 2.2)
import { communicationStyleTracker } from '../prompt/communication-style-tracker.js';

import type { HookFn } from '../types.js';

/**
 * Prompt hooks registry
 */
export const hooks: Record<string, HookFn> = {
  'prompt/antipattern-detector': antipatternDetector,
  'prompt/antipattern-warning': antipatternWarning,
  'prompt/context-injector': contextInjector,
  'prompt/context-pruning-advisor': contextPruningAdvisor,
  'prompt/memory-context': memoryContext,
  'prompt/satisfaction-detector': satisfactionDetector,
  'prompt/todo-enforcer': todoEnforcer,
  'prompt/pipeline-detector': pipelineDetector,
  // Intelligent Decision Capture System
  'prompt/capture-user-intent': captureUserIntent,
  // Memory Context Loader (Issue #245 - session-start memory loading)
  'prompt/memory-context-loader': memoryContextLoader,
  // Profile Injection (Issue #245 Phase 6.1)
  'prompt/profile-injector': profileInjector,
  // Communication Style Tracker (Issue #245 Phase 2.2)
  'prompt/communication-style-tracker': communicationStyleTracker,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
