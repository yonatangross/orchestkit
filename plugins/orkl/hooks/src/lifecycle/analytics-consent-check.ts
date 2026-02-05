/**
 * Analytics Consent Check - Check if user needs to be prompted for analytics consent
 * Part of OrchestKit Claude Plugin (#59)
 *
 * This hook runs on session start to check if user has been asked about analytics.
 * It outputs a gentle reminder or first-time prompt if appropriate.
 *
 * CC 2.1.7 Compliant: uses hookSpecificOutput.additionalContext for context injection
 */

import { existsSync, readFileSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { logHook, getProjectDir, outputSilentSuccess } from '../lib/common.js';

interface ConsentLog {
  events: Array<{
    action: string;
    timestamp: string;
  }>;
}

interface ConsentStatus {
  consented: boolean;
  asked: boolean;
}

/**
 * Read consent status from consent manager config
 */
function getConsentStatus(projectDir: string): ConsentStatus {
  const consentFile = `${projectDir}/.claude/feedback/consent-status.json`;

  if (!existsSync(consentFile)) {
    return { consented: false, asked: false };
  }

  try {
    const status = JSON.parse(readFileSync(consentFile, 'utf-8'));
    return {
      consented: status.consented === true,
      asked: status.asked === true,
    };
  } catch {
    return { consented: false, asked: false };
  }
}

/**
 * Get the last consent event from the log
 */
function getLastConsentEvent(projectDir: string): { action: string; timestamp: string } | null {
  const consentLog = `${projectDir}/.claude/feedback/consent-log.json`;

  if (!existsSync(consentLog)) {
    return null;
  }

  try {
    const log: ConsentLog = JSON.parse(readFileSync(consentLog, 'utf-8'));
    if (log.events && log.events.length > 0) {
      return log.events[log.events.length - 1];
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

/**
 * Check if 30 days have passed since the last decline
 */
function shouldShowReminder(lastTimestamp: string): boolean {
  try {
    const lastDate = new Date(lastTimestamp);
    const now = new Date();
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince >= 30;
  } catch {
    return false;
  }
}

/**
 * Analytics consent check hook
 */
export function analyticsConsentCheck(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const status = getConsentStatus(projectDir);

  // Already consented - nothing to do
  if (status.consented) {
    logHook('analytics-consent-check', 'User has consented to analytics');
    return outputSilentSuccess();
  }

  // Already asked and declined - check if we should show reminder
  if (status.asked) {
    const lastEvent = getLastConsentEvent(projectDir);

    if (lastEvent && (lastEvent.action === 'declined' || lastEvent.action === 'revoked')) {
      if (shouldShowReminder(lastEvent.timestamp)) {
        // Show gentle reminder (not blocking)
        logHook('analytics-consent-check', 'Showing 30-day reminder');
        return {
          continue: true,
          systemMessage:
            'Reminder: Anonymous analytics help improve OrchestKit. Enable with /ork:feedback opt-in',
        };
      }
    }

    // Don't show anything if recently asked
    logHook('analytics-consent-check', 'User recently declined, not prompting');
    return outputSilentSuccess();
  }

  // First time - show a brief notice (not the full prompt, to avoid blocking)
  logHook('analytics-consent-check', 'First time user, showing brief notice');
  return {
    continue: true,
    systemMessage:
      'OrchestKit collects local usage metrics. Share anonymously with /ork:feedback opt-in',
  };
}
