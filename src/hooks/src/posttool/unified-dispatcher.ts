/**
 * Unified PostToolUse Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates 3 essential PostToolUse hooks into a single dispatcher.
 * This reduces the number of "Async hook completed" messages to 1.
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
// Import individual hook implementations (essential: security + local state only)
// Analytics/telemetry hooks removed — now handled by HQ
import { redactSecrets } from '../skill/redact-secrets.js';
import { configChangeAuditor } from './config-change/security-auditor.js';
import { teamMemberStart } from './task/team-member-start.js';
import { commitNudge } from './commit-nudge.js';

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
  // Security: scrubs API keys from tool output (#684, #909)
  { name: 'redact-secrets', fn: redactSecrets, matcher: ['Bash', 'Write', 'Edit'] },
  // Config drift detection
  { name: 'config-change-auditor', fn: configChangeAuditor, matcher: ['Write', 'Edit'] },
  // Tracks active team members for team-size-gate (#902)
  { name: 'team-member-start', fn: teamMemberStart, matcher: ['Task', 'Agent'] },
  // Commit nudge: escalating reminders to commit work (CC 2.1.71 utilization)
  { name: 'commit-nudge', fn: commitNudge, matcher: ['Write', 'Edit', 'MultiEdit', 'Bash'] },
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
 * - Single "Async hook completed" message instead of 3 separate ones
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
