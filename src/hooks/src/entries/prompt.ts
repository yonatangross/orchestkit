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

// Prompt hooks (12) - UserPromptSubmit
import { antipatternDetector } from '../prompt/antipattern-detector.js';
import { antipatternWarning } from '../prompt/antipattern-warning.js';
import { contextInjector } from '../prompt/context-injector.js';
import { contextPruningAdvisor } from '../prompt/context-pruning-advisor.js';
import { memoryContext } from '../prompt/memory-context.js';
import { satisfactionDetector } from '../prompt/satisfaction-detector.js';
import { skillAutoSuggest } from '../prompt/skill-auto-suggest.js';
import { todoEnforcer } from '../prompt/todo-enforcer.js';
import { agentAutoSuggest } from '../prompt/agent-auto-suggest.js';

// Orchestration hooks (Issue #197)
import { agentOrchestrator } from '../prompt/agent-orchestrator.js';
import { skillInjector } from '../prompt/skill-injector.js';
import { pipelineDetector } from '../prompt/pipeline-detector.js';

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
  'prompt/skill-auto-suggest': skillAutoSuggest,
  'prompt/todo-enforcer': todoEnforcer,
  'prompt/agent-auto-suggest': agentAutoSuggest,
  // Orchestration hooks (Issue #197)
  'prompt/agent-orchestrator': agentOrchestrator,
  'prompt/skill-injector': skillInjector,
  'prompt/pipeline-detector': pipelineDetector,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
