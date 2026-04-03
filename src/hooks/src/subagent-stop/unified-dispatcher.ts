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

import { openSync, readSync, closeSync, fstatSync } from 'node:fs';
import type { HookInput, HookResult , HookContext} from '../types.js';
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

type HookFn = (input: HookInput, ctx?: HookContext) => HookResult | Promise<HookResult>;

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
// Transcript Quality Analysis (Issue #1245)
// -----------------------------------------------------------------------------

interface TranscriptMetrics {
  tool_call_count: number;
  tool_counts: Record<string, number>;
  unique_tools: number;
  error_count: number;
  completion_status: 'normal' | 'partial' | 'error';
  token_usage?: { input?: number; output?: number };
}

/** Max bytes to read from transcript (128KB) — enough for metrics without reading huge files */
const TRANSCRIPT_READ_LIMIT = 128 * 1024;

/**
 * Analyze a subagent transcript JSONL for lightweight quality metrics.
 * Uses bounded synchronous reads (no full file load) and pattern counting.
 * Returns null if the file is missing or unreadable.
 *
 * Issue #1245: SubagentStop transcript analysis hook for quality scoring
 */
function analyzeTranscript(transcriptPath: string): TranscriptMetrics | null {
  let fd: number | null = null;
  try {
    fd = openSync(transcriptPath, 'r');
    const fileSize = fstatSync(fd).size;
    if (fileSize === 0) return null;

    // Read up to TRANSCRIPT_READ_LIMIT bytes from the start
    const readSize = Math.min(fileSize, TRANSCRIPT_READ_LIMIT);
    const buf = Buffer.allocUnsafe(readSize);
    const bytesRead = readSync(fd, buf, 0, readSize, 0);
    closeSync(fd);
    fd = null;

    const content = buf.toString('utf8', 0, bytesRead);
    const lines = content.split('\n');

    const toolCounts: Record<string, number> = {};
    let totalToolCalls = 0;
    let errorCount = 0;
    let hasError = false;
    let inputTokens = 0;
    let outputTokens = 0;
    let hasTokenInfo = false;
    const lastLineWasTruncated = bytesRead < fileSize;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Fast pattern matching — avoid JSON.parse for every line
      // Tool calls: look for "tool_name" or "tool_use" patterns
      const toolMatch = trimmed.match(/"tool_name"\s*:\s*"([^"]+)"/);
      if (toolMatch) {
        const toolName = toolMatch[1];
        toolCounts[toolName] = (toolCounts[toolName] || 0) + 1;
        totalToolCalls++;
      }

      // Error detection: look for error indicators
      if (
        trimmed.includes('"error"') ||
        trimmed.includes('"is_error":true') ||
        trimmed.includes('"is_error": true') ||
        trimmed.includes('"retry"') ||
        trimmed.includes('"retrying"')
      ) {
        errorCount++;
        if (trimmed.includes('"is_error":true') || trimmed.includes('"is_error": true')) {
          hasError = true;
        }
      }

      // Token usage: look for usage fields
      const inputMatch = trimmed.match(/"input_tokens"\s*:\s*(\d+)/);
      if (inputMatch) {
        inputTokens += parseInt(inputMatch[1], 10);
        hasTokenInfo = true;
      }
      const outputMatch = trimmed.match(/"output_tokens"\s*:\s*(\d+)/);
      if (outputMatch) {
        outputTokens += parseInt(outputMatch[1], 10);
        hasTokenInfo = true;
      }
    }

    // Determine completion status
    let completionStatus: 'normal' | 'partial' | 'error';
    if (hasError) {
      completionStatus = 'error';
    } else if (lastLineWasTruncated) {
      // If we couldn't read the entire file, we can't be sure it completed
      completionStatus = 'partial';
    } else {
      completionStatus = 'normal';
    }

    return {
      tool_call_count: totalToolCalls,
      tool_counts: toolCounts,
      unique_tools: Object.keys(toolCounts).length,
      error_count: errorCount,
      completion_status: completionStatus,
      ...(hasTokenInfo ? { token_usage: { input: inputTokens, output: outputTokens } } : {}),
    };
  } catch {
    // File missing, unreadable, or parse error — all fine
    if (fd !== null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

/** @internal Exposed for testing */
export { analyzeTranscript as _analyzeTranscript };
export type { TranscriptMetrics as _TranscriptMetrics };

/**
 * Analyze transcript and write quality metrics to analytics JSONL.
 * Fire-and-forget — never throws.
 *
 * Issue #1245: SubagentStop transcript analysis hook for quality scoring
 */
function analyzeAndRecordTranscript(
  input: HookInput,
  agentType: string,
  agentName: string | undefined,
  durationMs: number,
): void {
  try {
    const transcriptPath = input.agent_transcript_path;
    if (!transcriptPath) return;

    const metrics = analyzeTranscript(transcriptPath);
    if (!metrics) return;

    // Fork cache metrics (CC 2.1.89 — #1227)
    // cache_creation_input_tokens: tokens written to cache (cold miss)
    // cache_read_input_tokens: tokens served from cache (hit)
    // cache_hit_pct = read / (creation + read) — standard Anthropic definition
    const isFork = Boolean(input.is_fork);
    const cacheCreationTokens = input.cache_creation_input_tokens ?? 0;
    const cacheReadTokens = input.cache_read_input_tokens ?? 0;
    const cacheTotalTokens = cacheCreationTokens + cacheReadTokens;
    const cacheHitPct = cacheTotalTokens > 0
      ? Math.round((cacheReadTokens / cacheTotalTokens) * 100)
      : undefined;

    appendAnalytics('subagent-quality.jsonl', {
      ts: new Date().toISOString(),
      pid: hashProject(process.env.CLAUDE_PROJECT_DIR || ''),
      agent: agentType,
      agent_name: agentName ?? null,
      is_fork: isFork,
      tool_call_count: metrics.tool_call_count,
      tool_counts: metrics.tool_counts,
      unique_tools: metrics.unique_tools,
      error_count: metrics.error_count,
      completion_status: metrics.completion_status,
      duration_ms: durationMs,
      ...(metrics.token_usage ? { token_usage: metrics.token_usage } : {}),
      ...(cacheHitPct !== undefined ? { cache_hit_pct: cacheHitPct } : {}),
    });
  } catch {
    // Analytics should never break the hook chain
  }
}

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

    // Issue #1245: Analyze transcript for quality scoring
    analyzeAndRecordTranscript(input, agentType, agentName, effectiveDuration);
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
/** One-time field name diagnostic — log CC input fields on first invocation */
let _fieldNamesLogged = false;

export async function unifiedSubagentStopDispatcher(input: HookInput, ctx?: HookContext): Promise<HookResult> {
  // Diagnostic: log CC input field names once for runtime verification (#1227)
  if (!_fieldNamesLogged) {
    _fieldNamesLogged = true;
    (ctx?.log ?? logHook)('subagent-stop-dispatcher', `CC input fields: ${Object.keys(input).sort().join(', ')}`, 'debug');
  }

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
    (ctx?.log ?? logHook)('subagent-stop-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}
