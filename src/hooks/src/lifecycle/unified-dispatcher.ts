/**
 * Unified SessionStart Dispatcher
 * Issue #235: Hook Architecture Refactor
 * Issue #239: Move initialization hooks to Setup event
 *
 * Consolidates session-specific async hooks into a single dispatcher.
 * Reduces "Async hook SessionStart completed" messages.
 *
 * Note: One-time initialization hooks (dependency-version-check)
 * moved to Setup dispatcher in Issue #239 - they only need to run once at plugin load.
 *
 * CC 2.1.19 Compliant: Single async hook with internal routing
 *
 * NOTE: Async hooks are fire-and-forget by design. They can only return
 * { async: true, asyncTimeout } - fields like systemMessage, continue,
 * decision are NOT processed by Claude Code for async hooks.
 * Failures are logged to file but not surfaced to users.
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, logHook } from '../lib/common.js';
import { getWebhookUrl } from '../lib/orchestration-state.js';

// Import session-specific hook implementations
// Note: dependency-version-check moved to setup/unified-dispatcher.ts (Issue #239)
import { patternSyncPull } from './pattern-sync-pull.js';
import { sessionEnvSetup } from './session-env-setup.js';
import { staleTeamCleanup } from './stale-team-cleanup.js';
import { staleCacheCleanup } from './stale-cache-cleanup.js';
import { typeErrorIndexer } from './type-error-indexer.js';

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
 * Registry of 5 session-specific async SessionStart hooks (local state + setup).
 * Analytics hooks (session-tracking, memory-metrics-collector) removed — now handled by HQ.
 * One-time initialization hooks moved to Setup dispatcher (Issue #239).
 */
const HOOKS: HookConfig[] = [
  { name: 'pattern-sync-pull', fn: patternSyncPull },
  { name: 'session-env-setup', fn: sessionEnvSetup },
  { name: 'stale-team-cleanup', fn: staleTeamCleanup },
  { name: 'stale-cache-cleanup', fn: staleCacheCleanup },
  { name: 'type-error-indexer', fn: typeErrorIndexer },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = () => HOOKS.map(h => h.name);

// -----------------------------------------------------------------------------
// Dispatcher Implementation
// -----------------------------------------------------------------------------

/**
 * Check webhook URL reachability once per session.
 * If configured but unreachable, log a clear warning so the user knows
 * why usage-summary-reporter and HTTP hooks will fail silently.
 */
async function checkWebhookHealth(): Promise<void> {
  const webhookUrl = getWebhookUrl();
  const hookToken = process.env.ORCHESTKIT_HOOK_TOKEN;

  if (!webhookUrl) return; // Not configured — nothing to check

  if (!hookToken) {
    logHook('webhook-health', 'webhookUrl is set but ORCHESTKIT_HOOK_TOKEN is missing — webhook hooks will be skipped');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(2000),
    });
    if (response.ok || response.status === 405) {
      // 405 = Method Not Allowed is fine for HEAD — means the server exists
      logHook('webhook-health', `Webhook endpoint reachable: ${webhookUrl} (${response.status})`);
    } else {
      logHook('webhook-health', `Webhook endpoint returned ${response.status}: ${webhookUrl} — session data may be lost. Is the server running?`, 'warn');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logHook('webhook-health', `Webhook endpoint unreachable: ${webhookUrl} (${msg}) — usage-summary-reporter will fail. Start the server or clear webhookUrl from orchestration config.`, 'warn');
  }
}

/**
 * Unified dispatcher that runs all SessionStart hooks in parallel
 */
export async function unifiedSessionStartDispatcher(input: HookInput, ctx?: HookContext): Promise<HookResult> {
  // Check webhook health once per session (non-blocking, runs alongside hooks)
  const webhookCheck = checkWebhookHealth().catch(() => {});

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
        logHook('session-start-dispatcher', `${hook.name} failed: ${message}`);
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
    (ctx?.log ?? logHook)('session-start-dispatcher', `${failures.length}/${HOOKS.length} hooks failed: ${failures.join(', ')}`);
  }

  // Wait for webhook health check to complete (non-blocking, errors already caught)
  await webhookCheck;

  // Async hooks always return silent success - CC ignores other fields
  return outputSilentSuccess();
}
