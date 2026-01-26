/**
 * Subagent Hooks Entry Point
 *
 * Hooks that run on subagent start/stop (SubagentStart, SubagentStop)
 * Bundle: subagent.mjs (~30 KB estimated)
 */

// Re-export types and utilities
export * from '../types.js';
export * from '../lib/common.js';

// Re-export orchestration modules needed by subagent hooks
export * from '../lib/orchestration-types.js';
export * from '../lib/orchestration-state.js';
export * from '../lib/retry-manager.js';
export * from '../lib/calibration-engine.js';

// SubagentStart hooks (5)
import { agentMemoryInject } from '../subagent-start/agent-memory-inject.js';
import { contextGate } from '../subagent-start/context-gate.js';
import { subagentContextStager } from '../subagent-start/subagent-context-stager.js';
import { subagentValidator } from '../subagent-start/subagent-validator.js';
import { taskLinker } from '../subagent-start/task-linker.js';

// SubagentStop hooks (11)
import { agentMemoryStore } from '../subagent-stop/agent-memory-store.js';
import { autoSpawnQuality } from '../subagent-stop/auto-spawn-quality.js';
import { contextPublisher } from '../subagent-stop/context-publisher.js';
import { feedbackLoop } from '../subagent-stop/feedback-loop.js';
import { handoffPreparer } from '../subagent-stop/handoff-preparer.js';
import { multiClaudeVerifier } from '../subagent-stop/multi-claude-verifier.js';
import { outputValidator } from '../subagent-stop/output-validator.js';
import { subagentQualityGate } from '../subagent-stop/subagent-quality-gate.js';
import { taskCompleter } from '../subagent-stop/task-completer.js';
import { retryHandler } from '../subagent-stop/retry-handler.js';
import { unifiedSubagentStopDispatcher } from '../subagent-stop/unified-dispatcher.js';

import type { HookFn } from '../types.js';

/**
 * Subagent hooks registry
 */
export const hooks: Record<string, HookFn> = {
  // SubagentStart hooks (5)
  'subagent-start/agent-memory-inject': agentMemoryInject,
  'subagent-start/context-gate': contextGate,
  'subagent-start/subagent-context-stager': subagentContextStager,
  'subagent-start/subagent-validator': subagentValidator,
  'subagent-start/task-linker': taskLinker,

  // SubagentStop hooks (11)
  'subagent-stop/agent-memory-store': agentMemoryStore,
  'subagent-stop/auto-spawn-quality': autoSpawnQuality,
  'subagent-stop/context-publisher': contextPublisher,
  'subagent-stop/feedback-loop': feedbackLoop,
  'subagent-stop/handoff-preparer': handoffPreparer,
  'subagent-stop/multi-claude-verifier': multiClaudeVerifier,
  'subagent-stop/output-validator': outputValidator,
  'subagent-stop/subagent-quality-gate': subagentQualityGate,
  'subagent-stop/task-completer': taskCompleter,
  'subagent-stop/retry-handler': retryHandler,
  'subagent-stop/unified-dispatcher': unifiedSubagentStopDispatcher,
};

export function getHook(name: string): HookFn | undefined {
  return hooks[name];
}

export function listHooks(): string[] {
  return Object.keys(hooks);
}
