/**
 * Unified SubagentStop Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 4 async SubagentStop hooks into a single dispatcher.
 * Reduces "Async hook SubagentStop completed" messages from 4 to 1.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { trackEvent } from '../lib/session-tracker.js';

// Import individual hook implementations
import { contextPublisher } from './context-publisher.js';
import { handoffPreparer } from './handoff-preparer.js';
import { feedbackLoop } from './feedback-loop.js';
import { agentMemoryStore } from './agent-memory-store.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HookFn = (input: HookInput) => HookResult | Promise<HookResult>;

interface HookConfig {
  name: string;
  fn: HookFn;
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/**
 * Registry of all async SubagentStop hooks consolidated into dispatcher
 */
const HOOKS: HookConfig[] = [
  { name: 'context-publisher', fn: contextPublisher },
  { name: 'handoff-preparer', fn: handoffPreparer },
  { name: 'feedback-loop', fn: feedbackLoop },
  { name: 'agent-memory-store', fn: agentMemoryStore },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

// -----------------------------------------------------------------------------
// Agent Result Tracking (Issue #245)
// -----------------------------------------------------------------------------

/**
 * Track agent result for user profiling
 * Issue #245: Multi-User Intelligent Decision Capture
 */
function trackAgentResult(input: HookInput): void {
  try {
    const agentType = input.subagent_type || input.agent_type || 'unknown';
    const success = !input.error;
    const durationMs = input.duration_ms;

    // Extract result quality indicators
    const output = input.agent_output || input.output || '';
    const outputLength = typeof output === 'string' ? output.length : 0;

    trackEvent('agent_spawned', agentType, {
      success,
      duration_ms: durationMs,
      output: {
        has_output: outputLength > 0,
        output_length: outputLength,
        has_error: !!input.error,
      },
      context: input.agent_id,
    });
  } catch {
    // Silent failure - tracking should never break hooks
  }
}

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Unified dispatcher that runs all SubagentStop hooks in parallel
 */
export async function unifiedSubagentStopDispatcher(input: HookInput): Promise<HookResult> {
  // Track agent result (Issue #245: Multi-User Intelligent Decision Capture)
  trackAgentResult(input);

  // Run all hooks in parallel
  const results = await Promise.allSettled(
    HOOKS.map(async hook => {
      try {
        const result = hook.fn(input);
        if (result instanceof Promise) {
          await result;
        }
        return { hook: hook.name, status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logHook('subagent-stop-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    logHook('subagent-stop-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}
