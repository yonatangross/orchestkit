/**
 * Mem0 Webhook Handler - Process incoming webhook events
 * Hook: PostToolUse (for bash/webhook-receiver.py calls)
 * CC 2.1.7 Compliant
 *
 * Features:
 * - Processes webhook events from mem0
 * - Routes to appropriate workflows
 * - Triggers auto-sync, decision sync, cleanup
 *
 * Version: 1.0.0
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, logHook } from '../lib/common.js';

/**
 * Handle incoming mem0 webhook events
 */
export function mem0WebhookHandler(input: HookInput): HookResult {
  logHook('mem0-webhook-handler', 'Mem0 webhook handler starting');

  const toolName = input.tool_name || '';
  const command = getField<string>(input, 'tool_input.command') || '';

  // Only process webhook-receiver.py calls
  if (toolName !== 'Bash' || !command.includes('webhook-receiver.py')) {
    return outputSilentSuccess();
  }

  // Extract event data from command output or tool result
  const eventDataStr = getField<string>(input, 'tool_result') || '';

  if (!eventDataStr) {
    logHook('mem0-webhook-handler', 'No event data found in webhook call');
    return outputSilentSuccess();
  }

  try {
    // Parse event data
    let eventData: Record<string, unknown>;
    try {
      eventData = JSON.parse(eventDataStr);
    } catch {
      logHook('mem0-webhook-handler', 'Could not parse event data');
      return outputSilentSuccess();
    }

    // Parse event type
    const eventType = (eventData.result as Record<string, unknown>)?.event_type ||
                     eventData.event_type || '';
    const memoryId = (eventData.result as Record<string, unknown>)?.memory_id ||
                    (eventData.memory as Record<string, unknown>)?.id || '';

    logHook('mem0-webhook-handler', `Processing webhook event: ${eventType} (memory: ${memoryId})`);

    // Log event for observability — actual sync is handled by dedicated hooks
    // (memory-bridge.ts for graph sync, mem0-pre-compaction-sync.ts for decision sync)
    // This handler logs webhook events for audit trail purposes.
    const knownEvents = ['memory.created', 'memory.updated', 'memory.deleted'];
    if (knownEvents.includes(eventType as string)) {
      logHook('mem0-webhook-handler', `Received ${eventType} for memory ${memoryId}`);
    } else {
      logHook('mem0-webhook-handler', `Received unknown event type: ${eventType}`);
    }
  } catch (error) {
    logHook('mem0-webhook-handler', `Error processing webhook: ${error}`);
  }

  return outputSilentSuccess();
}
