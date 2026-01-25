/**
 * Realtime Sync Hook - Graph-First Priority-based immediate memory persistence
 * Triggers on PostToolUse for Bash, Write, and Skill completions
 *
 * Purpose: Sync critical decisions immediately to knowledge graph
 *
 * Graph-First Architecture (v2.1):
 * - IMMEDIATE syncs target knowledge graph (mcp__memory__*) - always works
 * - mem0 cloud sync only if API key present AND critical priority
 *
 * Priority Classification:
 * - IMMEDIATE: "decided", "chose", "architecture", "security", "blocked", "breaking"
 * - BATCHED: "pattern", "convention", "preference"
 * - SESSION_END: Everything else (handled by existing Stop hooks)
 *
 * Version: 2.1.0 - CC 2.1.9/2.1.11 compliant, Graph-First Architecture
 * Part of Memory Fabric v2.1 - Graph-First Architecture
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, getProjectDir, getSessionId, logHook } from '../lib/common.js';

// Priority keywords
const IMMEDIATE_KEYWORDS = /decided|chose|architecture|security|blocked|breaking|critical|must|cannot|deprecated|removed|migration/i;
const BATCHED_KEYWORDS = /pattern|convention|preference|style|format|naming/i;

// Minimum content length to consider
const MIN_CONTENT_LENGTH = 30;

// Context pressure thresholds
const CONTEXT_EMERGENCY_THRESHOLD = 85;
const CONTEXT_CRITICAL_THRESHOLD = 90;

interface PendingItem {
  content: string;
  category: string;
  queued_at: string;
}

interface PendingFile {
  pending: PendingItem[];
  created_at: string;
}

/**
 * Get current context usage percentage
 */
function getContextPressure(): number {
  const pressure = parseInt(process.env.CLAUDE_CONTEXT_USED_PERCENTAGE || '0', 10);

  if (pressure === 0) {
    const tokensUsed = parseInt(process.env.CLAUDE_CONTEXT_TOKENS_USED || '0', 10);
    const maxTokens = parseInt(process.env.CLAUDE_CONTEXT_MAX_TOKENS || '0', 10);
    if (maxTokens > 0) {
      return Math.floor((tokensUsed * 100) / maxTokens);
    }
  }

  return pressure;
}

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
  // Try to extract a meaningful decision statement
  const patterns = [
    /[^.]*\b(decided|chose|selected|will use|must|cannot|blocked|breaking)[^.]*/i,
    /[^.]*\b(architecture|security|migration|deprecated)[^.]*/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[0].trim().substring(0, 300);
    }
  }

  // Final fallback: take first meaningful sentence
  const sentences = content.match(/^[^.]{30,200}\./);
  if (sentences) {
    return sentences[0].trim();
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
 * Initialize pending sync queue
 */
function initPendingQueue(pendingFile: string): void {
  if (!existsSync(pendingFile)) {
    try {
      mkdirSync(require('path').dirname(pendingFile), { recursive: true });
      writeFileSync(pendingFile, JSON.stringify({
        pending: [],
        created_at: new Date().toISOString(),
      }));
    } catch {
      // Ignore init errors
    }
  }
}

/**
 * Add to pending queue
 */
function addToPendingQueue(content: string, category: string, pendingFile: string): void {
  initPendingQueue(pendingFile);

  try {
    const data: PendingFile = JSON.parse(readFileSync(pendingFile, 'utf8'));
    data.pending.push({
      content,
      category,
      queued_at: new Date().toISOString(),
    });
    writeFileSync(pendingFile, JSON.stringify(data, null, 2));
    logHook('realtime-sync', `Added to pending queue: category=${category}, length=${content.length}`);
  } catch {
    // Ignore queue errors
  }
}

/**
 * Get pending count
 */
function getPendingCount(pendingFile: string): number {
  if (!existsSync(pendingFile)) return 0;

  try {
    const data: PendingFile = JSON.parse(readFileSync(pendingFile, 'utf8'));
    return data.pending?.length || 0;
  } catch {
    return 0;
  }
}

/**
 * Sync critical decisions in real-time
 */
export function realtimeSync(input: HookInput): HookResult {
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
  let priority = classifyPriority(toolOutput);
  logHook('realtime-sync', `Tool: ${toolName}, Priority: ${priority}, Content length: ${toolOutput.length}`);

  // Context pressure override
  const contextPressure = getContextPressure();
  const projectDir = getProjectDir();
  const sessionId = getSessionId();
  const pendingFile = `${projectDir}/.claude/logs/.mem0-pending-sync-${sessionId}.json`;

  // Upgrade BATCHED to IMMEDIATE if context pressure is high
  if (priority === 'BATCHED' && contextPressure >= CONTEXT_EMERGENCY_THRESHOLD) {
    priority = 'IMMEDIATE';
    logHook('realtime-sync', `EMERGENCY: Context at ${contextPressure}%, upgrading BATCHED to IMMEDIATE`);
  }

  // If critical (>90%), flush pending queue immediately
  if (contextPressure >= CONTEXT_CRITICAL_THRESHOLD) {
    const pendingCount = getPendingCount(pendingFile);
    if (pendingCount > 0) {
      logHook('realtime-sync', `CRITICAL: Context at ${contextPressure}%, flushing ${pendingCount} pending items`);

      return {
        continue: true,
        systemMessage: `[CRITICAL SYNC] Context at ${contextPressure}% - compaction imminent!

${pendingCount} items in pending queue need immediate sync to knowledge graph.
Pending sync file: ${pendingFile}

Execute mcp__memory__create_entities for each item in the pending file NOW
to preserve session context in the knowledge graph before compaction.`,
      };
    }
  }

  switch (priority) {
    case 'IMMEDIATE': {
      const decision = extractDecision(toolOutput);

      if (!decision || decision.length < 20) {
        logHook('realtime-sync', 'Could not extract meaningful decision');
        return outputSilentSuccess();
      }

      const category = detectCategory(decision);
      logHook('realtime-sync', `IMMEDIATE sync triggered: category=${category}`);

      return {
        continue: true,
        systemMessage: `[IMMEDIATE SYNC] Critical decision detected - store in knowledge graph now.

Category: ${category}
Decision: "${decision.substring(0, 200)}"

Store in knowledge graph with mcp__memory__create_entities:
\`\`\`json
{
  "entities": [{
    "name": "${category}-decision",
    "entityType": "Decision",
    "observations": ["${decision.substring(0, 300).replace(/"/g, '\\"')}"]
  }]
}
\`\`\`

This decision is critical and should be synced immediately for:
- Session continuity if interrupted
- Cross-agent knowledge sharing
- Future reference in similar contexts`,
      };
    }

    case 'BATCHED': {
      const decision = extractDecision(toolOutput);

      if (decision && decision.length >= 20) {
        const category = detectCategory(decision);
        addToPendingQueue(decision, category, pendingFile);

        const pendingCount = getPendingCount(pendingFile);

        // Auto-sync when queue reaches threshold (5+ items)
        if (pendingCount >= 5) {
          logHook('realtime-sync', `BATCHED queue has ${pendingCount} items - triggering batch sync`);

          return {
            continue: true,
            systemMessage: `[BATCHED SYNC] ${pendingCount} patterns/conventions queued for graph sync.

Latest: "${decision.substring(0, 100)}..." (${category})

These will be synced to knowledge graph at session end, or trigger batch sync now with mcp__memory__create_entities for each item in:
${pendingFile}`,
          };
        }
      }

      return outputSilentSuccess();
    }

    case 'SESSION_END':
    default:
      // Let existing Stop hooks handle this
      return outputSilentSuccess();
  }
}
