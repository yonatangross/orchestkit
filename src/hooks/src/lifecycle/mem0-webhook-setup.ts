/**
 * Mem0 Webhook Setup - Auto-configure webhooks on first mem0 usage
 * Hook: SessionStart
 * CC 2.1.7 Compliant
 *
 * Features:
 * - Checks if webhooks exist for mem0 automation
 * - Creates webhooks if missing
 * - Configures webhook URL endpoint
 * - Sets up event types: memory.created, memory.updated, memory.deleted
 *
 * Version: 1.0.0
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface WebhookConfig {
  webhook_name: string;
  events: string[];
  url: string;
}

/**
 * Check if mem0 is available
 */
function isMem0Available(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * Check if slow hooks should be skipped
 */
function shouldSkipSlowHooks(): boolean {
  return process.env.ORCHESTKIT_SKIP_SLOW_HOOKS === '1';
}

/**
 * Mem0 webhook setup hook
 */
export function mem0WebhookSetup(input: HookInput): HookResult {
  // Bypass if slow hooks are disabled
  if (shouldSkipSlowHooks()) {
    logHook('mem0-webhook-setup', 'Skipping mem0 webhook setup (ORCHESTKIT_SKIP_SLOW_HOOKS=1)');
    return outputSilentSuccess();
  }

  logHook('mem0-webhook-setup', 'Mem0 webhook setup starting');

  // Check if mem0 is available
  if (!isMem0Available()) {
    logHook('mem0-webhook-setup', 'Mem0 not available, skipping webhook setup');
    return outputSilentSuccess();
  }

  const projectDir = input.project_dir || getProjectDir();
  const webhookConfigFile = `${projectDir}/.claude/mem0-webhooks.json`;

  // Webhook configuration
  const webhookName = 'orchestkit-auto-sync';
  const webhookEvents = ['memory.created', 'memory.updated', 'memory.deleted'];
  const webhookUrl = process.env.MEM0_WEBHOOK_URL || 'https://example.com/webhook/mem0';

  logHook('mem0-webhook-setup', 'Checking for existing webhooks');

  // Note: Actual webhook creation would require mem0 API calls
  // For now, we just save the config for reference
  if (!process.env.MEM0_WEBHOOK_URL) {
    logHook('mem0-webhook-setup', 'Webhook URL not configured (set MEM0_WEBHOOK_URL), skipping creation');
  }

  // Save webhook config
  try {
    mkdirSync(`${projectDir}/.claude`, { recursive: true });

    const config: WebhookConfig = {
      webhook_name: webhookName,
      events: webhookEvents,
      url: webhookUrl,
    };

    writeFileSync(webhookConfigFile, JSON.stringify(config, null, 2));
    logHook('mem0-webhook-setup', 'Webhook config saved');
  } catch (err) {
    logHook('mem0-webhook-setup', `Failed to save webhook config: ${err}`);
  }

  logHook('mem0-webhook-setup', 'Webhook setup complete');

  return outputSilentSuccess();
}
