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

// Prompt hooks (11) - UserPromptSubmit
import { antipatternDetector } from '../prompt/antipattern-detector.js';
import { antipatternWarning } from '../prompt/antipattern-warning.js';
import { contextInjector } from '../prompt/context-injector.js';
import { contextPruningAdvisor } from '../prompt/context-pruning-advisor.js';
import { memoryContext } from '../prompt/memory-context.js';
import { satisfactionDetector } from '../prompt/satisfaction-detector.js';
import { todoEnforcer } from '../prompt/todo-enforcer.js';
import { agentAutoSuggest } from '../prompt/agent-auto-suggest.js';

// Orchestration hooks (Issue #197)
import { agentOrchestrator } from '../prompt/agent-orchestrator.js';
import { pipelineDetector } from '../prompt/pipeline-detector.js';

// Unified skill resolver (replaces skill-auto-suggest + skill-injector)
import { skillResolver } from '../prompt/skill-resolver.js';

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
  'prompt/agent-auto-suggest': agentAutoSuggest,
  // Orchestration hooks (Issue #197)
  'prompt/agent-orchestrator': agentOrchestrator,
  'prompt/pipeline-detector': pipelineDetector,
  // Unified skill resolver (replaces skill-auto-suggest + skill-injector)
  'prompt/skill-resolver': skillResolver,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
