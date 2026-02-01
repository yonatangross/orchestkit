/**
 * Queue Recovery - Process orphaned queues on first prompt
 *
 * Registered as UserPromptSubmit with once: true.
 * Since UserPromptSubmit hooks are synchronous, they CAN return
 * systemMessage that Claude will act on (unlike async Stop hooks).
 *
 * If a previous session crashed or the stop dispatcher's systemMessage
 * was discarded (fire-and-forget), queue items become orphaned. This
 * hook recovers them on the next session's first prompt.
 *
 * Stale queues (>24h) are archived instead of processed.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import { isMem0Configured } from '../lib/memory-writer.js';
import {
  readGraphQueue,
  aggregateGraphOperations,
  readMem0Queue,
  deduplicateMem0Memories,
  clearQueueFile,
  isQueueStale,
  archiveQueue,
  type QueuedMem0Memory,
  type AggregatedGraphOps,
} from '../lib/queue-processor.js';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// MESSAGE GENERATION
// =============================================================================

/**
 * Generate systemMessage for graph queue recovery
 */
function generateGraphRecoveryMessage(aggregated: AggregatedGraphOps): string {
  const { entities, relations, observations } = aggregated;

  if (entities.length === 0 && relations.length === 0 && observations.length === 0) {
    return '';
  }

  const parts: string[] = [
    '## Graph Memory Recovery',
    '',
    'Orphaned graph operations from a previous session were found.',
    'Execute these MCP calls to persist them:',
    '',
  ];

  if (entities.length > 0) {
    parts.push('### Create Entities');
    parts.push('```json');
    parts.push(`mcp__memory__create_entities({`);
    parts.push(`  "entities": ${JSON.stringify(entities, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
    parts.push(`})`);
    parts.push('```');
    parts.push('');
  }

  if (relations.length > 0) {
    parts.push('### Create Relations');
    parts.push('```json');
    parts.push(`mcp__memory__create_relations({`);
    parts.push(`  "relations": ${JSON.stringify(relations, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
    parts.push(`})`);
    parts.push('```');
    parts.push('');
  }

  if (observations.length > 0) {
    parts.push('### Add Observations');
    parts.push('```json');
    parts.push(`mcp__memory__add_observations({`);
    parts.push(`  "observations": ${JSON.stringify(observations, null, 2).split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')}`);
    parts.push(`})`);
    parts.push('```');
    parts.push('');
  }

  parts.push(`**Recovery:** ${entities.length} entities, ${relations.length} relations, ${observations.length} observations from previous session.`);

  return parts.join('\n');
}

/**
 * Generate systemMessage for mem0 queue recovery
 */
function generateMem0RecoveryMessage(memories: QueuedMem0Memory[]): string {
  if (memories.length === 0) return '';

  const parts: string[] = [
    '## Mem0 Memory Recovery',
    '',
    'Orphaned mem0 memories from a previous session were found.',
    'Execute these MCP calls to persist them:',
    '',
  ];

  let callIndex = 1;
  for (const memory of memories) {
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

  parts.push(`**Recovery:** ${memories.length} memories from previous session.`);

  return parts.join('\n');
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Recover orphaned queue items on first prompt
 *
 * Registered as UserPromptSubmit with once: true
 */
export function queueRecovery(input: HookInput): HookResult {
  const projectDir = input.project_dir || getProjectDir();
  const memoryDir = join(projectDir, '.claude', 'memory');
  const archiveDir = join(memoryDir, 'archive');

  const graphQueuePath = join(memoryDir, 'graph-queue.jsonl');
  const mem0QueuePath = join(memoryDir, 'mem0-queue.jsonl');

  const hasGraphQueue = existsSync(graphQueuePath);
  const hasMem0Queue = existsSync(mem0QueuePath) && isMem0Configured();

  if (!hasGraphQueue && !hasMem0Queue) {
    return outputSilentSuccess();
  }

  logHook('queue-recovery', 'Orphaned queue(s) detected, processing recovery');

  const messageParts: string[] = [];

  // Process graph queue
  if (hasGraphQueue) {
    if (isQueueStale(graphQueuePath, STALE_THRESHOLD_MS)) {
      logHook('queue-recovery', 'Graph queue stale (>24h), archiving');
      archiveQueue(graphQueuePath, archiveDir);
    } else {
      const operations = readGraphQueue(graphQueuePath);
      if (operations.length > 0) {
        const aggregated = aggregateGraphOperations(operations);
        const message = generateGraphRecoveryMessage(aggregated);
        if (message) {
          messageParts.push(message);
        }
      }
      clearQueueFile(graphQueuePath);
    }
  }

  // Process mem0 queue
  if (hasMem0Queue) {
    if (isQueueStale(mem0QueuePath, STALE_THRESHOLD_MS)) {
      logHook('queue-recovery', 'Mem0 queue stale (>24h), archiving');
      archiveQueue(mem0QueuePath, archiveDir);
    } else {
      const rawMemories = readMem0Queue(mem0QueuePath);
      if (rawMemories.length > 0) {
        const memories = deduplicateMem0Memories(rawMemories);
        const message = generateMem0RecoveryMessage(memories);
        if (message) {
          messageParts.push(message);
        }
      }
      clearQueueFile(mem0QueuePath);
    }
  }

  if (messageParts.length === 0) {
    return outputSilentSuccess();
  }

  const systemMessage = messageParts.join('\n\n---\n\n');

  logHook('queue-recovery', `Recovery message generated (${messageParts.length} sections)`);

  return {
    continue: true,
    systemMessage,
  };
}

export default queueRecovery;
