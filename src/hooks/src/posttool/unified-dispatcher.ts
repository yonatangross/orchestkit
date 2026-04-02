/**
 * Unified PostToolUse Dispatcher
 * Issue #235: Hook Architecture Refactor
 *
 * Consolidates essential PostToolUse hooks into a single dispatcher.
 * This reduces the number of "Async hook completed" messages to 1.
 *
 * CC 2.1.71: Async hooks CAN deliver additionalContext and systemMessage
 * to Claude on the next turn. Only decision/permissionDecision/continue
 * are ignored (the action already completed). The dispatcher collects
 * additionalContext from all hooks and forwards the combined result.
 */

import type { HookInput, HookResult, HookFn } from '../types.js';
import { outputSilentSuccess, outputWithContext, logHook } from '../lib/common.js';
// Import individual hook implementations (essential: security + local state only)
// Analytics/telemetry hooks removed — now handled by HQ
import { redactSecrets } from '../skill/redact-secrets.js';
import { configChangeAuditor } from './config-change/security-auditor.js';
import { teamMemberStart } from './task/team-member-start.js';
import { commitNudge } from './commit-nudge.js';
import { fingerprintSaver } from './expect/fingerprint-saver.js';
// CC 2.1.90: format-on-save is now safe — the "File content has changed" race was fixed
import { autoLint } from './auto-lint.js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HookConfig {
  name: string;
  fn: HookFn;
  matcher: string | string[];
}

// -----------------------------------------------------------------------------
// Hook Registry
// -----------------------------------------------------------------------------

/**
 * Registry of PostToolUse hooks consolidated into dispatcher.
 * Hooks may return additionalContext which the dispatcher forwards to CC.
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
  // Expect fingerprint auto-save: saves fingerprint after successful /ork:expect (#1191)
  { name: 'fingerprint-saver', fn: fingerprintSaver, matcher: ['Skill'] },
  // CC 2.1.90: format-on-save — auto-format with ruff/biome/prettier after Write/Edit
  // Toggle off with SKIP_AUTO_LINT=1
  { name: 'auto-lint', fn: autoLint, matcher: ['Write', 'Edit'] },
];

/** Exposed for registry wiring tests */
export const registeredHookNames = (): string[] => HOOKS.map(h => h.name);

/** Exposed for registry wiring tests */
export const registeredHookMatchers = (): Array<{ name: string; matcher: string | string[] }> =>
  HOOKS.map(h => ({ name: h.name, matcher: h.matcher }));

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

  // Run all matching hooks in parallel, capturing their results
  const results = await Promise.allSettled(
    matchingHooks.map(async hook => {
      try {
        const result = hook.fn(input);
        // Handle both sync and async hooks
        const hookResult = result instanceof Promise ? await result : result;
        return { hook: hook.name, status: 'success' as const, result: hookResult };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logHook('unified-dispatcher', `${hook.name} failed: ${message}`);
        return { hook: hook.name, status: 'error' as const, message };
      }
    })
  );

  // Collect failures and additionalContext from hook results
  const failures: string[] = [];
  const contexts: string[] = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      failures.push('unknown');
    } else if (result.value.status === 'error') {
      failures.push(result.value.hook);
    } else {
      // Forward additionalContext from hooks that returned it
      const ctx = result.value.result?.hookSpecificOutput?.additionalContext;
      if (ctx) contexts.push(ctx);
    }
  }

  if (failures.length > 0) {
    logHook('posttool-dispatcher', `${failures.length}/${matchingHooks.length} hooks failed: ${failures.join(', ')}`);
  }

  // Forward collected additionalContext to CC (delivered on next turn for async hooks)
  if (contexts.length > 0) {
    return outputWithContext(contexts.join('\n'));
  }

  return outputSilentSuccess();
}
