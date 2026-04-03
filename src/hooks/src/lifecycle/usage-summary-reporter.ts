/**
 * Usage Summary Reporter — SessionEnd Hook
 *
 * Posts OrchestKit-specific session data to HQ API that CC's native
 * HTTP hooks can't provide: hooks_triggered, event_counts, decisions,
 * problems, solutions.
 *
 * Fire-and-forget: always returns silent success regardless of POST outcome.
 * No-op when webhook URL or ORCHESTKIT_HOOK_TOKEN are missing.
 *
 * Depends on files written during the session (JSONL events, token state,
 * orchestration config). These must survive session-cleanup — currently safe
 * because cleanup only deletes agent dispatch state, not tracker/token files.
 *
 * Replaces the deprecated session-end-reporter.ts (#1007).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getSessionId, getCachedBranch, getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import { getTokenState } from '../lib/token-tracker.js';
import { getWebhookUrl } from '../lib/orchestration-state.js';
import { generateSessionSummary } from '../lib/session-tracker.js';
import { signPayload as signPayloadFn } from '../lib/crypto.js';
import { rotateTelemetryIfNeeded, cleanOldTelemetryFiles } from '../lib/telemetry-jsonl.js';

// Re-export for backwards compatibility — canonical source is lib/crypto.ts
export { signPayload } from '../lib/crypto.js';

const HOOK_NAME = 'usage-summary-reporter';

/** Fetch timeout in ms. Must be less than hooks.json timeout (8s) to allow clean exit. */
const FETCH_TIMEOUT_MS = 4000;

/** Read OrchestKit version from root package.json (cached at module load) */
const HOOK_VERSION = (() => {
  try {
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '';
    const pkgPath = join(pluginRoot, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return String(pkg.version || '0.0.0');
  } catch {
    return '0.0.0';
  }
})();

export function getProjectSlug(input?: HookInput): string {
  const dir = input?.project_dir || getProjectDir();
  return dir.split('/').pop() || 'unknown';
}

export async function usageSummaryReporter(input: HookInput): Promise<HookResult> {
  const hookUrl = getWebhookUrl();
  const hookToken = process.env.ORCHESTKIT_HOOK_TOKEN;

  if (!hookUrl || !hookToken) {
    logHook(HOOK_NAME, 'No webhookUrl/TOKEN configured, skipping');
    return outputSilentSuccess();
  }

  try {
    const tokenState = getTokenState();
    const summary = generateSessionSummary();

    const payload = {
      event: input.hook_event ?? 'SessionEnd',
      session_id: input.session_id || getSessionId(),
      project: getProjectSlug(input),
      timestamp: new Date().toISOString(),
      data: {
        token_usage: {
          totalTokensInjected: tokenState.totalTokensInjected,
          byHook: tokenState.byHook,
          byCategory: tokenState.byCategory,
        },
        usage_summary: {
          skills_used: summary.skills_used,
          agents_spawned: summary.agents_spawned,
          hooks_triggered: summary.hooks_triggered,
          event_counts: summary.event_counts,
          duration_ms: summary.duration_ms ?? null,
        },
      },
      metadata: {
        branch: getCachedBranch(),
        hook_version: HOOK_VERSION,
      },
    };

    const body = JSON.stringify(payload);
    const signature = signPayloadFn(body, hookToken);
    const url = `${hookUrl.replace(/\/$/, '')}/ingest`;

    logHook(HOOK_NAME, `POSTing usage summary to ${url} (skills: ${summary.skills_used.length}, hooks: ${summary.hooks_triggered.length})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CC-Hooks-Signature': signature },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    logHook(HOOK_NAME, `POST complete: ${response.status}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logHook(HOOK_NAME, `POST failed (non-blocking): ${msg}`, 'warn');
  }

  // Telemetry JSONL maintenance — rotate large files and clean old ones
  await rotateTelemetryIfNeeded().catch(() => {});
  await cleanOldTelemetryFiles().catch(() => {});

  return outputSilentSuccess();
}
