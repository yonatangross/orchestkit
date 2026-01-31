/**
 * Memory Context Loader - UserPromptSubmit Hook (once: true)
 *
 * Loads recent decisions from decisions.jsonl on the first prompt of each session,
 * providing Claude with project decision context.
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System.
 *
 * This hook runs ONCE per session (configured via `once: true` in hooks.json)
 * and provides Claude with recent project decisions for continuity.
 *
 * Storage: .claude/memory/decisions.jsonl (written by memory-writer.ts via capture-user-intent)
 *
 * CC 2.1.9 Compliant: Uses hookSpecificOutput.additionalContext for injection
 */

import type { HookInput, HookResult } from '../types.js';
import {
  outputSilentSuccess,
  outputPromptContext,
  logHook,
  getProjectDir,
} from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'memory-context-loader';
const MAX_DECISIONS = 10;
const MAX_CONTEXT_CHARS = 2000;

// =============================================================================
// TYPES
// =============================================================================

interface StoredDecision {
  id: string;
  type: string;
  content: {
    what: string;
    why?: string;
  };
  entities: string[];
  metadata: {
    timestamp: string;
    confidence: number;
    category: string;
    project: string;
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Read last N lines from a file (most recent decisions)
 */
function readLastLines(filePath: string, count: number): string[] {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);
    return lines.slice(-count);
  } catch {
    return [];
  }
}

/**
 * Parse JSONL lines into decision records, skipping malformed lines
 */
function parseDecisions(lines: string[]): StoredDecision[] {
  const decisions: StoredDecision[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed && parsed.content && parsed.content.what) {
        decisions.push(parsed);
      }
    } catch {
      // Skip malformed lines
    }
  }
  return decisions;
}

/**
 * Format decisions into markdown context
 */
function formatDecisionContext(decisions: StoredDecision[]): string {
  const parts: string[] = [];
  parts.push('## Recent Project Decisions');
  parts.push('');

  for (const d of decisions) {
    const typeLabel = d.type === 'preference' ? 'Preference' : 'Decision';
    let line = `- **[${typeLabel}]** ${d.content.what}`;
    if (d.content.why) {
      line += ` _(because: ${d.content.why})_`;
    }
    if (d.entities.length > 0) {
      line += ` [${d.entities.join(', ')}]`;
    }
    parts.push(line);

    // Check character limit
    const current = parts.join('\n');
    if (current.length > MAX_CONTEXT_CHARS) {
      parts.pop(); // Remove the line that exceeded the limit
      parts.push('- _(additional decisions available via mcp__memory__search_nodes)_');
      break;
    }
  }

  parts.push('');
  parts.push('_For deeper graph traversal: use mcp__memory__search_nodes or mcp__memory__open_nodes_');

  return parts.join('\n');
}

// =============================================================================
// MAIN HOOK
// =============================================================================

/**
 * Memory context loader - loads recent decisions on first prompt
 *
 * Runs once per session to inject recent project decisions as context.
 * Reads from .claude/memory/decisions.jsonl (produced by capture-user-intent
 * via memory-writer's storeDecision).
 */
export function memoryContextLoader(input: HookInput): HookResult {
  try {
    const projectDir = input.project_dir || getProjectDir();
    const decisionsPath = join(projectDir, '.claude', 'memory', 'decisions.jsonl');

    // No decisions file - nothing to load
    if (!existsSync(decisionsPath)) {
      logHook(HOOK_NAME, 'No decisions.jsonl found, skipping');
      return outputSilentSuccess();
    }

    // Read last N decisions
    const lines = readLastLines(decisionsPath, MAX_DECISIONS);
    if (lines.length === 0) {
      logHook(HOOK_NAME, 'decisions.jsonl is empty, skipping');
      return outputSilentSuccess();
    }

    // Parse decisions (skip malformed)
    const decisions = parseDecisions(lines);
    if (decisions.length === 0) {
      logHook(HOOK_NAME, 'No valid decisions found in file');
      return outputSilentSuccess();
    }

    // Most recent first
    decisions.reverse();

    // Build context
    const context = formatDecisionContext(decisions);

    logHook(HOOK_NAME, `Loaded ${decisions.length} recent decisions as context`);
    return outputPromptContext(context);
  } catch (err) {
    logHook(HOOK_NAME, `Error loading memory context: ${err}`, 'warn');
    return outputSilentSuccess();
  }
}
