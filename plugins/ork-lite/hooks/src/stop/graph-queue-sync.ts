/**
 * Graph Queue Sync - Process queued graph operations at session end
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System
 *
 * This hook reads the graph-queue.jsonl file and outputs a systemMessage
 * prompting Claude to execute the queued MCP graph operations.
 *
 * Refactored to use shared queue-processor.ts functions.
 *
 * CC 2.1.19 Compliant: Outputs systemMessage for Claude to act on
 */

import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import {
  readGraphQueue,
  aggregateGraphOperations,
  clearQueueFile,
  type AggregatedGraphOps,
} from '../lib/queue-processor.js';

// =============================================================================
// MESSAGE GENERATION
// =============================================================================

/**
 * Generate a systemMessage for Claude to execute the graph operations
 */
function generateSystemMessage(aggregated: AggregatedGraphOps): string {
  const { entities, relations, observations } = aggregated;

  if (entities.length === 0 && relations.length === 0 && observations.length === 0) {
    return '';
  }

  const parts: string[] = [
    '## Graph Memory Sync',
    '',
    'The following decisions and patterns were captured this session.',
    'To persist them to the knowledge graph, execute these MCP calls:',
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

  parts.push(`**Summary:** ${entities.length} entities, ${relations.length} relations, ${observations.length} observations to sync.`);

  return parts.join('\n');
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Process the graph queue at session end
 *
 * This hook:
 * 1. Reads all queued operations from graph-queue.jsonl
 * 2. Aggregates them to remove duplicates
 * 3. Outputs a systemMessage with MCP calls for Claude to execute
 * 4. Clears the queue
 */
export function graphQueueSync(_input: HookInput): HookResult {
  const queuePath = join(getProjectDir(), '.claude', 'memory', 'graph-queue.jsonl');

  // Read queued operations
  const operations = readGraphQueue(queuePath);

  if (operations.length === 0) {
    logHook('graph-queue-sync', 'No queued graph operations', 'debug');
    return outputSilentSuccess();
  }

  logHook('graph-queue-sync', `Processing ${operations.length} queued operations`, 'info');

  // Aggregate operations
  const aggregated = aggregateGraphOperations(operations);

  // Generate system message
  const systemMessage = generateSystemMessage(aggregated);

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
export default graphQueueSync;
