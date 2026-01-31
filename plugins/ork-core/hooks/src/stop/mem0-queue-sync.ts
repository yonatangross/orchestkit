/**
 * Mem0 Queue Sync - Process queued mem0 operations at session end
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System
 * GAP-006: mem0-queue.jsonl processor
 *
 * This hook reads the mem0-queue.jsonl file and outputs a systemMessage
 * prompting Claude to execute the queued mcp__mem0__add_memory operations.
 *
 * The queue contains memories queued by memory-writer.ts:queueForMem0()
 * with structure:
 * - text: The memory content
 * - user_id: Scoped user identifier (project/global)
 * - metadata: Category, confidence, source, etc.
 * - queued_at: ISO timestamp
 *
 * CC 2.1.19 Compliant: Outputs systemMessage for Claude to act on
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import { isMem0Configured } from '../lib/memory-writer.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Queued mem0 memory payload (written by memory-writer.ts:queueForMem0)
 */
export interface QueuedMem0Memory {
  /** Memory text content */
  text: string;
  /** User ID scope (project or global) */
  user_id: string;
  /** Memory metadata */
  metadata: {
    type?: string;
    category?: string;
    confidence?: number;
    source?: string;
    project?: string;
    timestamp?: string;
    entities?: string[];
    has_rationale?: boolean;
    has_alternatives?: boolean;
    importance?: 'high' | 'medium' | 'low';
    is_generalizable?: boolean;
    contributor_id?: string;
  };
  /** When this was queued */
  queued_at: string;
}

// =============================================================================
// PATHS
// =============================================================================

/**
 * Get path to mem0 operations queue
 */
function getMem0QueuePath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'mem0-queue.jsonl');
}

// =============================================================================
// QUEUE READING
// =============================================================================

/**
 * Read all queued memories from the mem0 queue
 */
function readQueuedMemories(): QueuedMem0Memory[] {
  const queuePath = getMem0QueuePath();

  if (!existsSync(queuePath)) {
    return [];
  }

  try {
    const content = readFileSync(queuePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const memories: QueuedMem0Memory[] = [];
    for (const line of lines) {
      try {
        const memory = JSON.parse(line) as QueuedMem0Memory;
        // Validate required fields
        if (memory.text && memory.user_id) {
          memories.push(memory);
        } else {
          logHook('mem0-queue-sync', `Skipping invalid memory (missing text or user_id)`, 'warn');
        }
      } catch {
        logHook('mem0-queue-sync', `Failed to parse queue line: ${line.slice(0, 100)}`, 'warn');
      }
    }

    return memories;
  } catch (error) {
    logHook('mem0-queue-sync', `Failed to read queue: ${error}`, 'warn');
    return [];
  }
}

/**
 * Clear the queue after processing
 */
function clearQueue(): void {
  const queuePath = getMem0QueuePath();

  if (existsSync(queuePath)) {
    try {
      unlinkSync(queuePath);
      logHook('mem0-queue-sync', 'Cleared mem0 queue', 'debug');
    } catch (error) {
      logHook('mem0-queue-sync', `Failed to clear queue: ${error}`, 'warn');
    }
  }
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Group memories by user_id for batched operations
 */
function groupByUserId(memories: QueuedMem0Memory[]): Map<string, QueuedMem0Memory[]> {
  const groups = new Map<string, QueuedMem0Memory[]>();

  for (const memory of memories) {
    const existing = groups.get(memory.user_id) || [];
    existing.push(memory);
    groups.set(memory.user_id, existing);
  }

  return groups;
}

/**
 * Deduplicate memories by text (keep most recent)
 */
function deduplicateMemories(memories: QueuedMem0Memory[]): QueuedMem0Memory[] {
  const seen = new Map<string, QueuedMem0Memory>();

  for (const memory of memories) {
    // Use text as dedup key (normalized)
    const key = memory.text.trim().toLowerCase();
    const existing = seen.get(key);

    // Keep the most recent one
    if (!existing || memory.queued_at > existing.queued_at) {
      seen.set(key, memory);
    }
  }

  return Array.from(seen.values());
}

// =============================================================================
// MESSAGE GENERATION
// =============================================================================

/**
 * Generate a systemMessage for Claude to execute the mem0 operations
 */
function generateSystemMessage(memories: QueuedMem0Memory[]): string {
  if (memories.length === 0) {
    return '';
  }

  // Group by user_id for organized output
  const grouped = groupByUserId(memories);

  const parts: string[] = [
    '## Mem0 Cloud Memory Sync',
    '',
    'The following decisions and patterns were captured this session.',
    'To persist them to mem0 cloud memory, execute these MCP calls:',
    '',
  ];

  // Generate add_memory calls for each memory
  let callIndex = 1;
  for (const [userId, userMemories] of grouped) {
    parts.push(`### Scope: ${userId}`);
    parts.push('');

    for (const memory of userMemories) {
      parts.push(`**Memory ${callIndex}:**`);
      parts.push('```json');
      parts.push(`mcp__mem0__add_memory({`);
      parts.push(`  "text": ${JSON.stringify(memory.text)},`);
      parts.push(`  "user_id": ${JSON.stringify(memory.user_id)},`);
      parts.push(`  "metadata": ${JSON.stringify(memory.metadata, null, 4).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
      parts.push(`})`);
      parts.push('```');
      parts.push('');
      callIndex++;
    }
  }

  // Summary
  const categories = new Set(memories.map(m => m.metadata.category).filter(Boolean));
  parts.push(`**Summary:** ${memories.length} memories to sync across ${grouped.size} scope(s).`);
  if (categories.size > 0) {
    parts.push(`Categories: ${Array.from(categories).join(', ')}`);
  }

  return parts.join('\n');
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Process the mem0 queue at session end
 *
 * This hook:
 * 1. Checks if MEM0_API_KEY is configured (early return if not)
 * 2. Reads all queued memories from mem0-queue.jsonl
 * 3. Deduplicates them (same text, keep most recent)
 * 4. Outputs a systemMessage with MCP calls for Claude to execute
 * 5. Clears the queue
 */
export function mem0QueueSync(_input: HookInput): HookResult {
  // Gate: Only process if mem0 is configured
  if (!isMem0Configured()) {
    logHook('mem0-queue-sync', 'MEM0_API_KEY not configured, skipping', 'debug');
    return outputSilentSuccess();
  }

  // Read queued memories
  const rawMemories = readQueuedMemories();

  if (rawMemories.length === 0) {
    logHook('mem0-queue-sync', 'No queued mem0 memories', 'debug');
    return outputSilentSuccess();
  }

  logHook('mem0-queue-sync', `Processing ${rawMemories.length} queued memories`, 'info');

  // Deduplicate
  const memories = deduplicateMemories(rawMemories);
  if (memories.length < rawMemories.length) {
    logHook(
      'mem0-queue-sync',
      `Deduplicated ${rawMemories.length} → ${memories.length} memories`,
      'debug'
    );
  }

  // Generate system message
  const systemMessage = generateSystemMessage(memories);

  // Clear the queue
  clearQueue();

  if (!systemMessage) {
    return outputSilentSuccess();
  }

  // Return with systemMessage for Claude to see
  return {
    continue: true,
    systemMessage,
  };
}

// Default export for hook system
export default mem0QueueSync;
