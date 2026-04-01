/**
 * Unified SubagentStop Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 2 async SubagentStop hooks into a single dispatcher.
 * Reduces "Async hook SubagentStop completed" messages to 1.
 * Analytics hooks (context-publisher, agent-memory-store) removed in #897 — now handled by HQ.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { trackEvent } from '../lib/session-tracker.js';
import { appendAnalytics, hashProject, getTeamContext } from '../lib/analytics.js';
import { appendLedgerEntry, resolveAgentContext } from '../lib/agent-attribution.js';

// Import individual hook implementations
// Analytics hooks removed — now handled by HQ (#897):
// - context-publisher (local context file rarely read)
// - agent-memory-store (HQ stores in cc_sessions.agents JSONB)
import { handoffPreparer } from './handoff-preparer.js';
import { feedbackLoop } from './feedback-loop.js';

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
  { name: 'handoff-preparer', fn: handoffPreparer },
  { name: 'feedback-loop', fn: feedbackLoop },
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
    const agentType = input.tool_input?.subagent_type as string
      || input.subagent_type
      || input.agent_type
      || 'unknown';
    const agentName = input.tool_input?.name as string || undefined;
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

    // Extract model from SubagentStop input or environment
    const model = input.tool_input?.model as string
      || process.env.CLAUDE_MODEL
      || 'unknown';

    // Cross-project analytics (Issue #459, #727)
    appendAnalytics('agent-usage.jsonl', {
      ts: new Date().toISOString(),
      pid: hashProject(process.env.CLAUDE_PROJECT_DIR || ''),
      agent: agentType,
      agent_name: agentName ?? null,
      model,
      duration_ms: durationMs,
      success,
      output_len: outputLength,
      last_msg_len: input.last_assistant_message?.length ?? null,
      ...getTeamContext(),
    });

    // Branch activity ledger for agent attribution (Issue #1195)
    // Extract the agent's task description (prompt) — what it was asked to do
    const prompt = input.tool_input?.prompt as string || '';
    const promptSummary = prompt.slice(0, 300).replace(/\n/g, ' ').trim();

    // Extract a meaningful summary: prefer last_assistant_message (what the agent concluded),
    // then output (what it returned), then fall back to the prompt snippet
    const lastMsg = input.last_assistant_message || '';
    const outputStr = typeof output === 'string' ? output : '';
    const summarySource = lastMsg.slice(0, 300) || outputStr.slice(0, 300) || promptSummary;
    const cleanSummary = summarySource.replace(/\n/g, ' ').trim() || agentType;

    // Resolve agent context from file-based session state (Issue #1195)
    const agentCtx = resolveAgentContext(input.agent_id || '');

    // Determine stage: first agent = lead, background = parallel, rest = follow-up
    const isBackground = !!(input.tool_input?.run_in_background);
    const stage = agentCtx.counter === 0 ? 0 : (isBackground ? 1 : 2);

    // Detect orchestrating skill from environment
    const orchestrator = process.env.CLAUDE_SKILL_NAME
      || process.env.ORCHESTKIT_ACTIVE_SKILL
      || undefined;

    // Duration: prefer CC-provided, fall back to start-time diff
    const effectiveDuration = durationMs || (agentCtx.startMs ? Date.now() - agentCtx.startMs : 0);

    appendLedgerEntry({
      ts: new Date().toISOString(),
      agent: agentType,
      agent_name: agentName,
      stage,
      duration_ms: effectiveDuration,
      success,
      summary: cleanSummary,
      prompt: promptSummary || undefined,
      commit_base: agentCtx.commitBase,
      orchestrator,
      background: isBackground || undefined,
      // CC 2.1.69: transcript path for post-mortem analysis
      transcript_path: input.agent_transcript_path || undefined,
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
