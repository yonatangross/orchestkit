/**
 * Mem0 Queue Sync - Process queued mem0 operations at session end
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System
 * GAP-006: mem0-queue.jsonl processor
 *
 * This hook reads the mem0-queue.jsonl file and outputs a systemMessage
 * prompting Claude to execute the queued mcp__mem0__add_memory operations.
 *
 * Refactored to use shared queue-processor.ts functions.
 *
 * CC 2.1.19 Compliant: Outputs systemMessage for Claude to act on
 */

import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import { isMem0Configured } from '../lib/memory-writer.js';
import {
  readMem0Queue,
  deduplicateMem0Memories,
  clearQueueFile,
  type QueuedMem0Memory,
} from '../lib/queue-processor.js';

// Re-export the type for consumers that import from this module
export type { QueuedMem0Memory };

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

  const queuePath = join(getProjectDir(), '.claude', 'memory', 'mem0-queue.jsonl');

  // Read queued memories
  const rawMemories = readMem0Queue(queuePath);

  if (rawMemories.length === 0) {
    logHook('mem0-queue-sync', 'No queued mem0 memories', 'debug');
    return outputSilentSuccess();
  }

  logHook('mem0-queue-sync', `Processing ${rawMemories.length} queued memories`, 'info');

  // Deduplicate
  const memories = deduplicateMem0Memories(rawMemories);
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
  clearQueueFile(queuePath);

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
