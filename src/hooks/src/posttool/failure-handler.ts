/**
 * PostToolUseFailure Handler
 * CC 2.1.25: Error-path hook that counts tool failures and adds context for structured errors
 *
 * Tracks tool failures (auto-enables debug mode after 3) and injects context via
 * additionalContext ONLY for RFC 9457 structured errors, which carry their own
 * title, category and retry guidance. Unstructured failures stay silent: the
 * generic regex tips table was cut because its unanchored matches fired on
 * unrelated failures and restated what the error text already said.
 */

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
import { getLogDir } from '../lib/paths.js';
import { atomicWriteSync } from '../lib/atomic-write.js';
import { extractStructuredError } from '../lib/retry-manager.js';
import { NOOP_CTX } from '../lib/context.js';

/** Track failures and auto-enable debug mode after 3 in a session */
const FAILURE_THRESHOLD = 3;

function getFailureCountPath(): string {
  return join(getLogDir(), 'failure-count.json');
}

function trackFailureAndMaybeEnableDebug(): void {
  try {
    const countPath = getFailureCountPath();
    const dir = getLogDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let count = 0;
    if (existsSync(countPath)) {
      const data = JSON.parse(readFileSync(countPath, 'utf8')) as { count?: number };
      count = data.count ?? 0;
    }
    count++;
    atomicWriteSync(countPath, JSON.stringify({ count, last: new Date().toISOString() }));

    if (count === FAILURE_THRESHOLD) {
      // Auto-enable debug mode
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const flagDir = join(home, '.claude', 'logs', 'ork');
      const flagPath = join(flagDir, 'debug-mode.flag');
      if (!existsSync(flagPath)) {
        mkdirSync(flagDir, { recursive: true });
        atomicWriteSync(flagPath, `enabled=${new Date().toISOString()}\nreason=auto-${count}-failures\n`);
        logHook('failure-handler', `Auto-enabled debug mode after ${count} failures`, 'warn');
        process.stderr.write(`[orchestkit] Debug mode auto-enabled after ${count} tool failures — hook diagnostics now active\n`);
      }
    }
  } catch {
    // Never crash on failure tracking
  }
}

export function failureHandler(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  // Get error information from the input. CC sends this as `error`, not
  // `tool_error` — the latter is never populated (verified against the
  // shipped binary's payload builder, #3418), which made this handler
  // silently no-op on every real tool failure.
  const errorMessage = input.error || '';
  const toolName = input.tool_name || 'unknown';
  // CC 2.1.119: duration_ms is set server-side on PostToolUse + PostToolUseFailure
  // — accurate for streaming/async tools where local Date.now() would miss
  // dispatch/queue overhead. Falls back to undefined for older CC versions.
  const durationMs = typeof input.duration_ms === 'number' ? input.duration_ms : undefined;

  // Skip if no error info
  if (!errorMessage) {
    return outputSilentSuccess();
  }

  const durationStr = durationMs !== undefined ? ` (${durationMs}ms)` : '';
  ctx.log('failure-handler', `Tool ${toolName} failed${durationStr}: ${errorMessage.slice(0, 200)}`);

  // Track failures — auto-enable debug after threshold
  trackFailureAndMaybeEnableDebug();

  // Try RFC 9457 structured error first — deterministic, richer context
  const structured = extractStructuredError(errorMessage);
  if (structured) {
    ctx.log('failure-handler', `Structured error: ${structured.error_category} (retryable=${structured.retryable})`);
    const parts = [
      `[OrchestKit] Structured error from ${toolName} (${structured.error_category}):`,
      `- ${structured.title}`,
    ];
    if (structured.what_you_should_do) {
      parts.push(`- ${structured.what_you_should_do}`);
    }
    if (structured.retryable && structured.retry_after) {
      parts.push(`- Retryable: wait ${structured.retry_after}s before retrying`);
    } else if (!structured.retryable) {
      parts.push(`- Not retryable${structured.owner_action_required ? ' — owner action required' : ''}`);
    }
    if (durationMs !== undefined) {
      parts.push(`- Failed after ${durationMs}ms`);
    }
    return outputWithContext(parts.join('\n'), 'PostToolUseFailure');
  }

  // Not a structured error: stay silent. The generic tips table that used to
  // answer here ("File not found", "Resource is locked", ...) matched any
  // failure whose text merely contained a common word (`lock` matches `block`
  // and `clock`, `heap` matches any heap-related message) and told the model
  // what the error text already said. Failure tracking above still runs.
  return outputSilentSuccess();
}
