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
export * from '../lib/orchestration-state.js';
export * from '../lib/task-integration.js';
export * from '../lib/retry-manager.js';

// --- Individual hooks still registered separately in hooks.json ---
// (prompt/profile-injector deleted 2026-09-01: the @deprecated stub was a
// no-op with no hooks.json entry; the real work is materializeProfileRules()
// called from lifecycle/sync-session-dispatcher at SessionStart.)

// --- Unified dispatcher (Issue #448) ---
// Consolidates: context-injector, todo-enforcer,
// communication-style-tracker, antipattern-detector, antipattern-warning,
// memory-context
import { unifiedPromptDispatcher } from '../prompt/unified-dispatcher.js';

// Handoff injector — restores context from previous session (runOnce in dispatcher)
import { handoffInjector } from '../prompt/handoff-injector.js';

// M140 G3 (#1790) — /goal convergence telemetry start hook
import { goalTracker } from '../prompt/goal-tracker.js';

// M119 (#1795) — AskUserQuestion picker stall mitigation moved to
// lifecycle/ask-fallback-injector (M104 PR-A: SessionStart caches the reminder
// in the prompt prefix instead of re-injecting it every turn).

// M119 PR-2 (#1794 follow-up) — picks up deferred worktree advisories
import { worktreeAdvisoryConsumer } from '../prompt/worktree-advisory-consumer.js';

// P3-A3: UserPromptExpansion observer (CC 2.1.208) — observer-only telemetry
import { promptExpansionObserver } from '../prompt/prompt-expansion-observer.js';

// ACTIVE: registered in hooks.json (UserPromptSubmit). The old "legacy, not in
// hooks.json" label here was wrong and misled a 2026-09-01 dead-code sweep.
import { thrashDetector } from '../prompt/thrash-detector.js';
// communicationStyleTracker removed: replaced by type:prompt hook in hooks.json (#980)

import type { HookFn } from '../types.js';

/**
 * Prompt hooks registry
 *
 * Issue #448: most every-turn hooks are consolidated into unified-dispatcher;
 * the rest are registered individually in hooks.json. Every map entry below is
 * dispatchable; dead slots are deleted, not kept "for compat" (#3867 sweep).
 */
export const hooks: Record<string, HookFn> = {
  'prompt/unified-dispatcher': unifiedPromptDispatcher,
  'prompt/handoff-injector': handoffInjector,
  // M140 G3 (#1790) — /goal convergence telemetry
  'prompt/goal-tracker': goalTracker,
  // M119 (#1795) — ask-fallback-injector moved to lifecycle/ in M104 PR-A
  // (SessionStart-cached reminder, see ../lifecycle/ask-fallback-injector.js)
  // M119 PR-2 (#1794 follow-up) — deferred worktree advisory consumer
  'prompt/worktree-advisory-consumer': worktreeAdvisoryConsumer,
  // P3-A3: UserPromptExpansion (CC 2.1.208) — never blocks, never modifies
  'prompt/prompt-expansion-observer': promptExpansionObserver,
  // ACTIVE in hooks.json (UserPromptSubmit); previously mislabeled "legacy"
  'prompt/thrash-detector': thrashDetector,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}

// Phase 4: HookContext DI
export { buildContext } from '../lib/context.js';
