/**
 * Agent Browser Safety Hook
 * Validates agent-browser CLI commands for safety
 * CC 2.1.9: Injects safety context via additionalContext
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputAllowWithContext,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';

/**
 * Blocked URL patterns for agent-browser
 */
const BLOCKED_URL_PATTERNS = [
  /localhost.*admin/i,
  /127\.0\.0\.1.*admin/i,
  /internal\./i,
  /intranet\./i,
  /\.local\//i,
  /file:\/\//i,
  // Auth/OAuth provider domains - sensitive login pages
  /accounts\.google\.com/i,
  /login\.microsoftonline\.com/i,
  /auth0\.com/i,
  /okta\.com/i,
  /login\.live\.com/i,
  /appleid\.apple\.com/i,
  /github\.com\/login/i,
  /gitlab\.com\/users\/sign_in/i,
];

/**
 * Sensitive action patterns
 */
const SENSITIVE_ACTIONS = [
  'click.*delete',
  'click.*remove',
  'fill.*password',
  'fill.*credit',
  'submit.*payment',
];

/**
 * Extract URL from agent-browser command
 */
function extractUrl(command: string): string | null {
  const urlMatch = command.match(/(?:navigate|goto|open)\s+["']?([^"'\s]+)["']?/i);
  return urlMatch ? urlMatch[1] : null;
}

/**
 * Check if URL is blocked
 */
function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Check if action is sensitive
 */
function isSensitiveAction(command: string): boolean {
  return SENSITIVE_ACTIONS.some((pattern) => new RegExp(pattern, 'i').test(command));
}

/**
 * Validate agent-browser commands for safety
 */
export function agentBrowserSafety(input: HookInput): HookResult {
  const command = input.tool_input.command || '';

  // Only process agent-browser commands
  if (!/agent-browser|ab\s/.test(command)) {
    return outputSilentSuccess();
  }

  // Extract and check URL
  const url = extractUrl(command);

  if (url && isBlockedUrl(url)) {
    logPermissionFeedback('deny', `Blocked URL: ${url}`, input);
    logHook('agent-browser-safety', `BLOCKED: ${url}`);

    return outputDeny(
      `agent-browser blocked: URL matches blocked pattern.

URL: ${url}

Blocked patterns include internal, localhost admin, and file:// URLs.
If this is intentional, use direct browser access instead.`
    );
  }

  // Check for sensitive actions
  if (isSensitiveAction(command)) {
    const context = `Sensitive browser action detected:
${command.slice(0, 100)}...

This may interact with:
- Delete/remove buttons
- Password fields
- Payment forms

Proceed with caution. Verify target elements.`;

    logPermissionFeedback('allow', 'Sensitive action warning', input);
    logHook('agent-browser-safety', 'Sensitive action detected');
    return outputAllowWithContext(context);
  }

  // Safe command
  logPermissionFeedback('allow', 'agent-browser command validated', input);
  return outputSilentSuccess();
}
