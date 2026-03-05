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
  logHook,
  writeRulesFile,
} from '../lib/common.js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// CONSTANTS
// =============================================================================

const HOOK_NAME = 'memory-context-loader';
const MAX_DECISIONS = 10;
const MAX_CONTEXT_CHARS = 3000;

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
 * Parse JSONL lines into decision records, skipping malformed lines.
 * Deduplicates by content.what (keeps most recent occurrence).
 */
function parseDecisions(lines: string[]): StoredDecision[] {
  const decisions: StoredDecision[] = [];
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed?.content?.what) {
        decisions.push(parsed);
      }
    } catch {
      // Skip malformed lines
    }
  }

  // Deduplicate by content.what — keep the most recent (last) occurrence
  const seen = new Map<string, number>();
  for (let i = 0; i < decisions.length; i++) {
    seen.set(decisions[i].content.what, i);
  }
  return decisions.filter((_, i) => {
    const d = decisions[i];
    return seen.get(d.content.what) === i;
  });
}

/**
 * Filter out noise entries — system warnings captured as user decisions.
 * e.g., Next.js/CC warnings like "selected the directory of..."
 */
function filterNoiseDecisions(decisions: StoredDecision[]): StoredDecision[] {
  const NOISE_PATTERNS = [
    /^selected the directory of/i,
    /^⚠\s*Warning:/i,
    /^Error:/i,
    /^inferred your workspace/i,
  ];

  return decisions.filter(d => {
    const what = d.content.what;
    // Skip entries that match noise patterns
    if (NOISE_PATTERNS.some(p => p.test(what))) return false;
    // Skip very short meaningless entries (< 10 chars after trimming)
    if (what.trim().length < 10) return false;
    return true;
  });
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
/**
 * Materialize recent decisions to .claude/rules/recent-decisions.md
 * Called from sync-session-dispatcher at SessionStart (correct lifecycle point).
 */
export function materializeDecisionRules(projectDir: string): void {
  const decisionsPath = join(projectDir, '.claude', 'memory', 'decisions.jsonl');
  if (!existsSync(decisionsPath)) {
    logHook(HOOK_NAME, 'No decisions.jsonl found, skipping');
    return;
  }

  const lines = readLastLines(decisionsPath, MAX_DECISIONS);
  if (lines.length === 0) return;

  const decisions = parseDecisions(lines);
  if (decisions.length === 0) return;

  const filtered = filterNoiseDecisions(decisions);
  if (filtered.length === 0) return;
  filtered.reverse();

  const context = formatDecisionContext(filtered);
  const rulesDir = join(projectDir, '.claude', 'rules');
  writeRulesFile(rulesDir, 'recent-decisions.md', context, HOOK_NAME);
  logHook(HOOK_NAME, `Wrote ${filtered.length} decisions to rules file`);
}

/**
 * @deprecated Use materializeDecisionRules() from SessionStart instead.
 * Kept for backward compatibility — returns silent success (materialization moved to SessionStart).
 */
export function memoryContextLoader(_input: HookInput): HookResult {
  logHook(HOOK_NAME, 'Skipping — materialization moved to SessionStart');
  return outputSilentSuccess();
}
