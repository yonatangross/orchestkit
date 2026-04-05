/**
 * Realtime Sync Hook - Decision Classification and Audit Logger
 * Triggers on PostToolUse for Bash, Write, Edit, Skill, and Task completions
 *
 * Purpose: Classify and log critical decisions for audit trail.
 *
 * Fix #903: Removed dead pending queue (.pending-sync-{session}.json) that was
 * never consumed by any Stop hook. The IMMEDIATE/BATCHED paths queued to a file
 * that nothing ever read — data was silently abandoned. Decision data now reaches
 * HQ via audit-logger + usage-summary-reporter (already in the PostToolUse dispatcher).
 *
 * What remains: priority classification + logHook audit trail (zero file I/O).
 *
 * Version: 4.0.0 - Removed dead queue, kept classification + logging
 */

import type { HookInput, HookResult , HookContext} from '../types.js';
import { outputSilentSuccess, getField } from '../lib/common.js';
import { NOOP_CTX } from '../lib/context.js';

// Priority keywords
const IMMEDIATE_KEYWORDS = /decided|chose|architecture|security|blocked|breaking|critical|deprecated|removed|migration/i;
const BATCHED_KEYWORDS = /pattern|convention|preference|style|format|naming/i;

// Minimum content length to consider
const MIN_CONTENT_LENGTH = 60;

/**
 * Classify priority of content
 */
function classifyPriority(content: string): 'IMMEDIATE' | 'BATCHED' | 'SESSION_END' {
  if (IMMEDIATE_KEYWORDS.test(content)) {
    return 'IMMEDIATE';
  }
  if (BATCHED_KEYWORDS.test(content)) {
    return 'BATCHED';
  }
  return 'SESSION_END';
}

/**
 * Extract the decision/insight from content
 */
function extractDecision(content: string): string {
  const keywords1 = /\b(decided|chose|selected|will use|must|cannot|blocked|breaking)\b/i;
  const keywords2 = /\b(architecture|security|migration|deprecated)\b/i;
  const sentenceList = content.split('.');

  for (const keyword of [keywords1, keywords2]) {
    for (const sentence of sentenceList) {
      if (keyword.test(sentence)) {
        return sentence.trim().substring(0, 300);
      }
    }
  }

  const firstSentence = sentenceList.find(s => s.trim().length >= 30);
  if (firstSentence) {
    return `${firstSentence.trim().substring(0, 200)}.`;
  }

  return content.substring(0, 300).trim();
}

/**
 * Detect category from content
 */
function detectCategory(content: string): string {
  const contentLower = content.toLowerCase();

  if (/security|auth|jwt|oauth|cors|xss/.test(contentLower)) return 'security';
  if (/architecture|design|structure|system/.test(contentLower)) return 'architecture';
  if (/database|schema|migration|postgres|sql/.test(contentLower)) return 'database';
  if (/blocked|issue|bug|problem|cannot/.test(contentLower)) return 'blocker';
  if (/breaking|deprecated|removed|migration/.test(contentLower)) return 'breaking-change';
  if (/api|endpoint|route|rest/.test(contentLower)) return 'api';
  if (/decided|chose|selected/.test(contentLower)) return 'decision';

  return 'general';
}

/**
 * Classify decisions and log for audit trail.
 * Fix #903: No longer writes to pending queue files — zero file I/O.
 * Decision data reaches HQ via audit-logger + usage-summary-reporter.
 */
export function realtimeSync(input: HookInput, ctx: HookContext = NOOP_CTX): HookResult {
  const toolName = input.tool_name || '';

  // Self-guard: Only process relevant tools
  if (!['Bash', 'Write', 'Edit', 'Skill', 'Task'].includes(toolName)) {
    return outputSilentSuccess();
  }

  // Get tool output/result
  let toolOutput = '';
  switch (toolName) {
    case 'Bash': {
      toolOutput = String(getField<unknown>(input, 'tool_output') || input.tool_output || '');
      const command = getField<string>(input, 'tool_input.command') || '';
      if (command) {
        toolOutput = `${command}\n${toolOutput}`;
      }
      break;
    }
    case 'Write':
    case 'Edit': {
      const content = getField<string>(input, 'tool_input.new_string') ||
                     getField<string>(input, 'tool_input.content') || '';
      const filePath = getField<string>(input, 'tool_input.file_path') || '';
      toolOutput = filePath ? `Writing to ${filePath}: ${content}` : content;
      break;
    }
    case 'Skill':
    case 'Task': {
      toolOutput = String(getField<unknown>(input, 'tool_result') || input.tool_output || '');
      break;
    }
  }

  // Skip if output is too short
  if (!toolOutput || toolOutput.length < MIN_CONTENT_LENGTH) {
    return outputSilentSuccess();
  }

  // Classify priority
  const priority = classifyPriority(toolOutput);

  // Only log IMMEDIATE and BATCHED (SESSION_END handled by stop hooks)
  if (priority === 'SESSION_END') {
    return outputSilentSuccess();
  }

  const decision = extractDecision(toolOutput);
  if (!decision || decision.length < 20) {
    return outputSilentSuccess();
  }

  const category = detectCategory(decision);
  ctx.log('realtime-sync', `${priority} decision: category=${category}, "${decision.substring(0, 100)}"`);

  return outputSilentSuccess();
}
