/**
 * Unified PostToolUse Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates multiple async PostToolUse hooks into a single dispatcher.
 * This reduces the number of "Async hook completed" messages from ~17 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 *
 * NOTE: Async hooks are fire-and-forget by design. They can only return
 * { async: true, asyncTimeout } - fields like systemMessage, continue,
 * decision are NOT processed by Claude Code for async hooks.
 * Failures are logged to file but not surfaced to users.
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';

// Import individual hook implementations
import { sessionMetrics } from './session-metrics.js';
import { auditLogger } from './audit-logger.js';
import { calibrationTracker } from './calibration-tracker.js';
import { patternExtractor } from './bash/pattern-extractor.js';
import { codeStyleLearner } from './write/code-style-learner.js';
import { namingConventionLearner } from './write/naming-convention-learner.js';
import { skillEditTracker } from './skill-edit-tracker.js';
import { coordinationHeartbeat } from './coordination-heartbeat.js';
import { skillUsageOptimizer } from './skill/skill-usage-optimizer.js';
import { memoryBridge } from './memory-bridge.js';
import { realtimeSync } from './realtime-sync.js';
import { issueProgressCommenter } from './bash/issue-progress-commenter.js';
import { issueSubtaskUpdater } from './bash/issue-subtask-updater.js';
import { mem0WebhookHandler } from './mem0-webhook-handler.js';
import { userTracking } from './user-tracking.js';
// GAP-011: Wire solution-detector to enable problem-tracker functionality
import { solutionDetector } from './solution-detector.js';

// Issue #243: Consolidate tool-preference-learner to reduce async hook spam
import { toolPreferenceLearner } from './tool-preference-learner.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HookFn = (input: HookInput) => HookResult | Promise<HookResult>;

interface HookConfig {
  name: string;
  fn: HookFn;
  matcher: string | string[];
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/**
 * Registry of all async PostToolUse hooks consolidated into dispatcher
 */
const HOOKS: HookConfig[] = [
  // Wildcard matchers (run for all tools)
  { name: 'session-metrics', fn: sessionMetrics, matcher: '*' },
  { name: 'audit-logger', fn: auditLogger, matcher: '*' },
  { name: 'calibration-tracker', fn: calibrationTracker, matcher: '*' },

  // Bash-specific
  { name: 'pattern-extractor', fn: patternExtractor, matcher: 'Bash' },
  { name: 'issue-progress-commenter', fn: issueProgressCommenter, matcher: 'Bash' },
  { name: 'issue-subtask-updater', fn: issueSubtaskUpdater, matcher: 'Bash' },
  { name: 'mem0-webhook-handler', fn: mem0WebhookHandler, matcher: 'Bash' },

  // Write/Edit-specific
  { name: 'code-style-learner', fn: codeStyleLearner, matcher: ['Write', 'Edit'] },
  { name: 'naming-convention-learner', fn: namingConventionLearner, matcher: ['Write', 'Edit'] },
  { name: 'skill-edit-tracker', fn: skillEditTracker, matcher: ['Write', 'Edit'] },

  // Task-specific
  { name: 'coordination-heartbeat', fn: coordinationHeartbeat, matcher: 'Task' },

  // Skill-specific
  { name: 'skill-usage-optimizer', fn: skillUsageOptimizer, matcher: 'Skill' },

  // MCP memory-specific
  { name: 'memory-bridge', fn: memoryBridge, matcher: ['mcp__mem0__add_memory', 'mcp__memory__create_entities'] },

  // Multi-tool matcher
  { name: 'realtime-sync', fn: realtimeSync, matcher: ['Bash', 'Write', 'Edit', 'Skill', 'Task'] },

  // User tracking (Issue #245) - tracks all tool usage, skills, and agents
  { name: 'user-tracking', fn: userTracking, matcher: '*' },

  // GAP-011: Solution detector - pairs tool outputs with open problems
  { name: 'solution-detector', fn: solutionDetector, matcher: ['Bash', 'Write', 'Edit', 'Task'] },

  // Issue #243: Tool preference learner - previously separate async hook causing spam
  { name: 'tool-preference-learner', fn: toolPreferenceLearner, matcher: '*' },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

/** Exposed for registry wiring tests */
export const registeredHookMatchers = () => HOOKS.map(h => ({ name: h.name, matcher: h.matcher }));

// -----------------------------------------------------------------------------
// Matcher Logic
// -----------------------------------------------------------------------------

/**
 * Check if a tool matches a matcher pattern
 * Exported for direct unit testing
 */
export function matchesTool(toolName: string, matcher: string | string[]): boolean {
  if (matcher === '*') return true;

  if (Array.isArray(matcher)) {
    return matcher.includes(toolName);
  }

  return toolName === matcher;
}

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all matching hooks in parallel
 *
 * Benefits:
 * - Single "Async hook completed" message instead of 14
 * - Centralized error handling
 * - Consistent timeout behavior
 * - Easier to debug and maintain
 */
export async function unifiedDispatcher(input: HookInput): Promise<HookResult> {
  const toolName = input.tool_name || '';

  // Filter hooks that match this tool
  const matchingHooks = HOOKS.filter(h => matchesTool(toolName, h.matcher));

  if (matchingHooks.length === 0) {
    return outputSilentSuccess();
  }

  // Run all matching hooks in parallel
  const results = await Promise.allSettled(
    matchingHooks.map(async hook => {
      try {
        const result = hook.fn(input);
        // Handle both sync and async hooks
        if (result instanceof Promise) {
          await result;
        }
        return { hook: hook.name, status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logHook('unified-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Count failures for logging (async hooks can't report to users)
  const failures: string[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      failures.push('unknown');
    } else if (result.value.status === 'error') {
      failures.push(result.value.hook);
    }
  }

  // Log failures (async hooks are fire-and-forget - can't surface to users)
  if (failures.length > 0) {
    logHook('posttool-dispatcher', `${failures.length}/${matchingHooks.length} hooks failed: ${failures.join(', ')}`);
  }

  // Async hooks always return silent success - CC ignores other fields
  return outputSilentSuccess();
}
