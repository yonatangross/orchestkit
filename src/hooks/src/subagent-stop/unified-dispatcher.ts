/**
 * Unified SubagentStop Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates SubagentStop processing into a single dispatcher AND writes the
 * local activation analytics: agent-usage.jsonl (per-agent activation + usage
 * metrics) and subagent-quality.jsonl (transcript quality scoring).
 *
 * The context-publisher and agent-memory-store hooks were removed in #897 (HQ
 * owns the local context file + the cc_sessions.agents JSONB store) — local
 * analytics writing stayed here and is NOT delegated to HQ.
 *
 * History: this dispatcher was orphaned (unregistered in hooks.json) from
 * v7.30.0 until #2653 re-registered it on SubagentStop — which left
 * agent-usage.jsonl frozen for ~78 days. The registry-wiring e2e test now
 * asserts the registration so it cannot silently regress again.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 */

import { openSync, readSync, closeSync, fstatSync, existsSync } from 'node:fs';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, getProjectDir, getSessionId } from '../lib/common.js';
import { trackEvent } from '../lib/session-tracker.js';
import { appendAnalytics, hashProject, getTeamContext } from '../lib/analytics.js';
import { appendLedgerEntry, resolveAgentContext } from '../lib/agent-attribution.js';
import { loadAccumState, saveAccumState } from '../lib/session-token-accum.js';

// Import individual hook implementations.
// Removed in #897 (HQ owns these concerns) — the local agent-usage /
// subagent-quality analytics writes below are unaffected by that removal:
// - context-publisher (local context file rarely read)
// - agent-memory-store (HQ stores in cc_sessions.agents JSONB)
import { handoffPreparer } from './handoff-preparer.js';
import { feedbackLoop } from './feedback-loop.js';
import { NOOP_CTX } from '../lib/context.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HookFn = (input: HookInput, ctx: HookContext) => HookResult | Promise<HookResult>;

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
  /**
   * Model that served the subagent's turns, read from the transcript's assistant
   * entries (#3034). This is the ONLY real source: CC delivers no `tool_input`
   * at SubagentStop, so the previous `input.tool_input?.model` read was constant
   * "unknown" on 100% of 11,319 rows. Measured recovery over 333 real
   * transcripts: 95.5%.
   */
  model?: string;
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
    let model: string | undefined;
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

      // #3034: the transcript is the only place the serving model appears —
      // CC sends no tool_input at SubagentStop. First hit wins; a subagent's
      // turns are served by one model, and scanning on means re-matching it
      // on every assistant line for nothing.
      if (!model) {
        const modelMatch = trimmed.match(/"model"\s*:\s*"([^"]+)"/);
        if (modelMatch) model = modelMatch[1];
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
      ...(model ? { model } : {}),
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
 * #1479 — accumulate cache_read / cache_creation token counts into the
 * per-session token accumulator so the pre-compact prompt and context-warn
 * hooks can adapt their messaging based on cache heat. Best-effort only.
 */
function recordCacheTokens(input: HookInput, ctx: HookContext): void {
  const cacheRead = input.cache_read_input_tokens ?? 0;
  const cacheCreation = input.cache_creation_input_tokens ?? 0;
  if (cacheRead === 0 && cacheCreation === 0) return;
  try {
    const projectDir = ctx.projectDir || getProjectDir();
    const sessionId = ctx.sessionId || getSessionId();
    const state = loadAccumState(projectDir, sessionId);
    state.cacheReadTokens += cacheRead;
    state.cacheCreationTokens += cacheCreation;
    state.updatedAt = new Date().toISOString();
    saveAccumState(projectDir, sessionId, state);
  } catch {
    // best-effort
  }
}

/**
 * True when the stop payload names a transcript that is actually on disk.
 * A missing path and a path pointing at nothing are the same answer here.
 */
function hasTranscriptOnDisk(transcriptPath: string | undefined): boolean {
  if (!transcriptPath) return false;
  try {
    return existsSync(transcriptPath);
  } catch {
    return false;
  }
}

/**
 * A SubagentStop is PHANTOM when three independent signals agree that no agent
 * ever ran under this agent_id (#3035):
 *
 *   1. no type from the payload nor from SubagentStart staging (#245)
 *   2. no staged start timestamp — SubagentStart never fired for this id
 *   3. no transcript on disk — path absent, or pointing at nothing
 *
 * All three are required. Any one alone is unsafe: a real agent can miss the
 * staged start (hook disabled, project-dir mismatch, spawned before the plugin
 * loaded) and a real agent can be typeless — but a real agent always leaves a
 * transcript. That third signal is what protects a long-running agent whose
 * staged start has already been consumed.
 *
 * Measured over 859 live ledger rows the conjunction is exact: 0 of 477 unknown
 * rows had a readable transcript; 382 of 382 attributed rows did.
 *
 * Do NOT "fix" this by correlating harder. f2e0159e7 (#2850) already shipped
 * SubagentStart staging + correlation for this exact symptom and the rate went
 * 24% -> 38%. This class has no SubagentStart to correlate with, by construction.
 */
function isPhantomStop(agentType: string, startMs: number, hasTranscript: boolean): boolean {
  return agentType === 'unknown' && startMs === 0 && !hasTranscript;
}

/**
 * Track agent result for user profiling
 * Issue #245: Multi-User Intelligent Decision Capture
 */
function trackAgentResult(input: HookInput): void {
  try {
    // Resolve file-based session context first (Issue #1195) — it also carries
    // the subagent_type staged at SubagentStart (#245), which is the only source
    // of the type for forks/background agents whose SubagentStop payload omits it.
    const agentCtx = resolveAgentContext(input.agent_id || '');

    const agentType = input.tool_input?.subagent_type as string
      || input.subagent_type
      || input.agent_type
      || agentCtx.type
      || 'unknown';
    // Still read for the branch-activity LEDGER and transcript quality record
    // below — those are separate sinks from agent-usage.jsonl. It is also always
    // undefined in practice (no tool_input at SubagentStop), but `undefined`
    // omits the key there rather than writing a constant, so it stays honest.
    const agentName = input.tool_input?.name as string || undefined;
    const success = !input.error;

    // #3035: classify BEFORE anything counts this as a spawn. One stat(2) is
    // noise beside the locked session-state read+write resolveAgentContext just
    // performed, and statting unconditionally is what makes `has_transcript`
    // trustworthy on attributed rows too.
    const hasTranscript = hasTranscriptOnDisk(input.agent_transcript_path);
    const phantom = isPhantomStop(agentType, agentCtx.startMs, hasTranscript);

    // #3034: CC delivers neither `duration_ms` nor `tool_input` nor
    // `agent_output`/`output` at SubagentStop — 0 of 11,319 real rows carried
    // any of them. The only true sources are the SubagentStart-staged start
    // time and the transcript, so both are computed before the write.
    const effectiveDuration = input.duration_ms
      || (agentCtx.startMs ? Date.now() - agentCtx.startMs : 0);
    const metrics = hasTranscript && input.agent_transcript_path
      ? analyzeTranscript(input.agent_transcript_path)
      : null;

    // Extract result quality indicators
    const output = input.agent_output || input.output || '';
    const outputLength = typeof output === 'string' ? output.length : 0;

    // A phantom never ran — keep it out of the user profile's spawn counts.
    // Guarded separately from the analytics write below: these are independent
    // sinks, and user profiling is the less durable one. Sharing the outer
    // try meant a throwing trackEvent silently destroyed the analytics row for
    // that spawn — the record we most want when something is going wrong.
    if (!phantom) {
      try {
        trackEvent('agent_spawned', agentType, {
          success,
          duration_ms: effectiveDuration || undefined,
          output: {
            has_output: outputLength > 0,
            output_length: outputLength,
            has_error: !!input.error,
          },
          context: input.agent_id,
        });
      } catch {
        // Profiling is best-effort; never let it cost us the analytics row.
      }
    }

    // Cross-project analytics (Issue #459, #727)
    // #3034: `agent_name` and `output_len` are deliberately NOT written — both
    // read payload fields CC never sends, so they were constant on 100% of rows.
    // A constant key reads as data; absence is honest.
    // #3035: phantoms ARE written, marked. Skipping would destroy the only
    // evidence of a phenomenon whose cause is still unknown. `has_transcript` is
    // written on every row from this version on, so its ABSENCE dates a row to
    // before this fix — `select(.has_transcript == null)` isolates the legacy set.
    appendAnalytics('agent-usage.jsonl', {
      ts: new Date().toISOString(),
      pid: hashProject(process.env.CLAUDE_PROJECT_DIR || ''),
      agent: agentType,
      model: metrics?.model ?? null,
      duration_ms: effectiveDuration > 0 ? effectiveDuration : null,
      success,
      last_msg_len: input.last_assistant_message?.length ?? null,
      has_transcript: hasTranscript,
      ...(phantom ? { phantom: true } : {}),
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

    // Determine stage: first agent = lead, background = parallel, rest = follow-up
    const isBackground = !!(input.tool_input?.run_in_background);
    const stage = agentCtx.counter === 0 ? 0 : (isBackground ? 1 : 2);

    // Detect orchestrating skill from environment
    const orchestrator = process.env.CLAUDE_SKILL_NAME
      || process.env.ORCHESTKIT_ACTIVE_SKILL
      || undefined;

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

export async function unifiedSubagentStopDispatcher(input: HookInput, ctx: HookContext = NOOP_CTX): Promise<HookResult> {
  // Diagnostic: log CC input field names once for runtime verification (#1227)
  if (!_fieldNamesLogged) {
    _fieldNamesLogged = true;
    ctx.log('subagent-stop-dispatcher', `CC input fields: ${Object.keys(input).sort().join(', ')}`, 'debug');
  }

  // Track agent result (Issue #245: Multi-User Intelligent Decision Capture)
  trackAgentResult(input);

  // M119 #1479: roll up cache token usage into session accumulator
  recordCacheTokens(input, ctx);

  // Run all hooks in parallel
  const results = await Promise.allSettled(
    HOOKS.map(async hook => {
      try {
        const result = hook.fn(input, ctx);
        if (result instanceof Promise) {
          await result;
        }
        return { hook: hook.name, status: 'success' };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.log('subagent-stop-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error', message };
      }
    })
  );

  // Log summary for debugging (only errors)
  const errors = results.filter(
    r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')
  );

  if (errors.length > 0) {
    ctx.log('subagent-stop-dispatcher', `${errors.length}/${HOOKS.length} hooks had errors`);
  }

  return outputSilentSuccess();
}
