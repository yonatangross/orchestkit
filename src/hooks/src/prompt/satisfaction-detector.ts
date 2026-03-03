/**
 * Satisfaction Detector - UserPromptSubmit Hook
 * Detects user satisfaction signals from conversation patterns
 * CC 2.1.7 Compliant
 *
 * Strategy:
 * - Analyze user prompt for positive/negative signals
 * - Track satisfaction per session
 * - Log to feedback system for reporting
 *
 * Performance optimization:
 * - Sampling mode: only analyzes every Nth prompt to reduce overhead
 * - Configure via SATISFACTION_SAMPLE_RATE (default: 3)
 *
 * Part of Feedback System (#57)
 */

import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, outputPromptContext, logHook, getProjectDir, getSessionId } from '../lib/common.js';
import { trackEvent } from '../lib/session-tracker.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { bufferWrite } from '../lib/analytics-buffer.js';
import { join, dirname } from 'node:path';

// Configuration
const MIN_PROMPT_LENGTH = 2;
const BUG_NUDGE_THRESHOLD = 2; // Suggest /ork:feedback bug after N negative signals per session

// Positive signal patterns
const POSITIVE_PATTERNS = [
  /\bthank/i,
  /\bgreat\b/i,
  /\bperfect\b/i,
  /\bexcellent\b/i,
  /\bawesome\b/i,
  /\bworks?\b.*\b(well|great|perfectly)/i,
  /\bthat('s| is) (exactly|just) what/i,
  /\bnice\b/i,
  /\bgood job\b/i,
  /\bwell done\b/i,
  /\blooks? good\b/i,
  /\blgtm\b/i,
  /\bship it\b/i,
];

// Negative signal patterns
const NEGATIVE_PATTERNS = [
  /\bno(t| ).*right/i,
  /\bwrong\b/i,
  /\bdoesn't work/i,
  /\bbroken\b/i,
  /\bfailed\b/i,
  /\btry again\b/i,
  /\bstart over\b/i,
  /\bundo\b/i,
  /\brevert\b/i,
  /\bfrustrat/i,
  /\bannoy/i,
  /\bconfus/i,
  /\bstill (not|doesn't)/i,
  /\bdidn't (work|help)/i,
  /\bthat's not/i,
];

/**
 * Detect satisfaction from prompt
 */
function detectSatisfaction(prompt: string): 'positive' | 'negative' | 'neutral' {
  // Check positive patterns
  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(prompt)) {
      return 'positive';
    }
  }

  // Check negative patterns
  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(prompt)) {
      return 'negative';
    }
  }

  return 'neutral';
}

/**
 * Get counter file path
 */
function getCounterFilePath(projectDir: string): string {
  return join(projectDir, '.claude', '.satisfaction-counter');
}

/**
 * Get or increment counter for sampling
 */
function getAndIncrementCounter(projectDir: string): number {
  const counterFile = getCounterFilePath(projectDir);

  // Ensure directory exists
  const dir = dirname(counterFile);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  let counter = 0;
  if (existsSync(counterFile)) {
    try {
      counter = parseInt(readFileSync(counterFile, 'utf8').trim(), 10) || 0;
    } catch {
      // Ignore
    }
  }

  counter++;

  try {
    writeFileSync(counterFile, String(counter));
  } catch {
    // Ignore
  }

  return counter;
}

/**
 * Log satisfaction signal to feedback file
 */
function logSatisfaction(sessionId: string, sentiment: string, context: string, projectDir: string): void {
  const feedbackDir = join(projectDir, '.claude', 'feedback');
  const logFile = join(feedbackDir, 'satisfaction.log');

  // Ensure directory exists
  if (!existsSync(feedbackDir)) {
    try {
      mkdirSync(feedbackDir, { recursive: true });
    } catch {
      return;
    }
  }

  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} | ${sessionId} | ${sentiment} | ${context}\n`;

  try {
    bufferWrite(logFile, logEntry);
  } catch {
    // Ignore logging errors
  }
}

/**
 * Get the path for the per-session negative signal counter file.
 */
function getNegativeCounterPath(projectDir: string, sessionId: string): string {
  return join(projectDir, '.claude', `.negative-count-${sessionId}`);
}

/**
 * Get the path for the per-session bug nudge flag (one nudge per session).
 */
function getBugNudgeFlagPath(projectDir: string, sessionId: string): string {
  return join(projectDir, '.claude', `.bug-nudge-sent-${sessionId}`);
}

/**
 * Increment and return the per-session negative signal count.
 */
function incrementNegativeCount(projectDir: string, sessionId: string): number {
  const filePath = getNegativeCounterPath(projectDir, sessionId);
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  let count = 0;
  if (existsSync(filePath)) {
    try {
      count = parseInt(readFileSync(filePath, 'utf8').trim(), 10) || 0;
    } catch {
      // Ignore
    }
  }

  count++;

  try {
    writeFileSync(filePath, String(count));
  } catch {
    // Ignore
  }

  return count;
}

/**
 * Check if the bug nudge has already been sent this session.
 */
function wasBugNudgeSent(projectDir: string, sessionId: string): boolean {
  return existsSync(getBugNudgeFlagPath(projectDir, sessionId));
}

/**
 * Mark the bug nudge as sent for this session.
 */
function markBugNudgeSent(projectDir: string, sessionId: string): void {
  const filePath = getBugNudgeFlagPath(projectDir, sessionId);
  const dir = dirname(filePath);

  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  try {
    writeFileSync(filePath, '1');
  } catch {
    // Ignore
  }
}

/**
 * Satisfaction detector hook
 */
export function satisfactionDetector(input: HookInput): HookResult {
  const prompt = input.prompt || '';
  const projectDir = input.project_dir || getProjectDir();
  const sessionId = input.session_id || getSessionId();

  // Get sample rate from environment (default: 3)
  const sampleRate = parseInt(process.env.SATISFACTION_SAMPLE_RATE || '3', 10);

  // Get and increment counter for sampling
  const counter = getAndIncrementCounter(projectDir);

  // Skip if not on sampling interval (for performance)
  if (sampleRate > 1 && counter % sampleRate !== 0) {
    return outputSilentSuccess();
  }

  logHook('satisfaction-detector', `Satisfaction detector hook starting (sample ${counter})`);

  // Skip empty prompts
  if (!prompt) {
    return outputSilentSuccess();
  }

  // Skip very short prompts (likely commands)
  if (prompt.length < MIN_PROMPT_LENGTH) {
    return outputSilentSuccess();
  }

  // Skip prompts that look like commands (start with /)
  if (prompt.startsWith('/')) {
    return outputSilentSuccess();
  }

  // Detect satisfaction
  const sentiment = detectSatisfaction(prompt);

  // Only log non-neutral signals to avoid noise
  if (sentiment !== 'neutral') {
    // Truncate context for logging
    let context = prompt.slice(0, 50);
    if (prompt.length > 50) {
      context += '...';
    }

    // Log the satisfaction signal
    logSatisfaction(sessionId, sentiment, context, projectDir);

    // Track in session tracker for user profile aggregation
    try {
      trackEvent('preference_stated' as any, sentiment, {
        context,
        success: true,
      });
    } catch {
      // Ignore tracking errors
    }

    logHook('satisfaction-detector', `Detected ${sentiment} satisfaction signal`);

    // Bug nudge: after BUG_NUDGE_THRESHOLD negative signals, suggest filing a bug (once per session)
    if (sentiment === 'negative') {
      const negativeCount = incrementNegativeCount(projectDir, sessionId);

      if (negativeCount >= BUG_NUDGE_THRESHOLD && !wasBugNudgeSent(projectDir, sessionId)) {
        markBugNudgeSent(projectDir, sessionId);
        logHook('satisfaction-detector', `Bug nudge triggered after ${negativeCount} negative signals`, 'info');
        return outputPromptContext(
          '[Feedback] Multiple issues detected in this session. ' +
          'If you are experiencing an OrchestKit bug, you can run `/ork:feedback bug` to file a report.'
        );
      }
    }
  }

  // Output CC 2.1.7 compliant JSON (silent success)
  return outputSilentSuccess();
}
