/**
 * Graph Queue Sync - Process queued graph operations at session end
 *
 * Part of Issue #245: Multi-User Intelligent Decision Capture System
 *
 * This hook reads the graph-queue.jsonl file and outputs a systemMessage
 * prompting Claude to execute the queued MCP graph operations.
 *
 * The queue contains:
 * - create_entities: New entities to create in the knowledge graph
 * - create_relations: Relations between entities
 * - add_observations: New observations to add to existing entities
 *
 * CC 2.1.19 Compliant: Outputs systemMessage for Claude to act on
 */

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HookInput, HookResult } from '../types.js';
import { getProjectDir, logHook, outputSilentSuccess } from '../lib/common.js';
import type { QueuedGraphOperation, GraphEntity, GraphRelation } from '../lib/memory-writer.js';

// =============================================================================
// PATHS
// =============================================================================

/**
 * Get path to graph operations queue
 */
function getGraphQueuePath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'graph-queue.jsonl');
}

/**
 * Get path to processed queue archive (for debugging)
 */

// =============================================================================
// QUEUE READING
// =============================================================================

/**
 * Read all queued operations from the graph queue
 */
function readQueuedOperations(): QueuedGraphOperation[] {
  const queuePath = getGraphQueuePath();

  if (!existsSync(queuePath)) {
    return [];
  }

  try {
    const content = readFileSync(queuePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());

    const operations: QueuedGraphOperation[] = [];
    for (const line of lines) {
      try {
        const op = JSON.parse(line) as QueuedGraphOperation;
        operations.push(op);
      } catch {
        logHook('graph-queue-sync', `Failed to parse queue line: ${line.slice(0, 100)}`, 'warn');
      }
    }

    return operations;
  } catch (error) {
    logHook('graph-queue-sync', `Failed to read queue: ${error}`, 'warn');
    return [];
  }
}

/**
 * Clear the queue after processing
 */
function clearQueue(): void {
  const queuePath = getGraphQueuePath();

  if (existsSync(queuePath)) {
    try {
      unlinkSync(queuePath);
      logHook('graph-queue-sync', 'Cleared graph queue', 'debug');
    } catch (error) {
      logHook('graph-queue-sync', `Failed to clear queue: ${error}`, 'warn');
    }
  }
}

// =============================================================================
// OPERATION AGGREGATION
// =============================================================================

/**
 * Aggregate multiple operations into batched calls
 * Combines all create_entities into one call, all create_relations into one call, etc.
 */
function aggregateOperations(operations: QueuedGraphOperation[]): {
  entities: GraphEntity[];
  relations: GraphRelation[];
  observations: Array<{ entityName: string; contents: string[] }>;
} {
  const entities: GraphEntity[] = [];
  const relations: GraphRelation[] = [];
  const observations: Array<{ entityName: string; contents: string[] }> = [];

  // Track seen entity names to avoid duplicates
  const seenEntities = new Set<string>();
  const seenRelations = new Set<string>();

  for (const op of operations) {
    if (op.type === 'create_entities' && op.payload.entities) {
      for (const entity of op.payload.entities) {
        if (!seenEntities.has(entity.name)) {
          entities.push(entity);
          seenEntities.add(entity.name);
        }
      }
    }

    if (op.type === 'create_relations' && op.payload.relations) {
      for (const rel of op.payload.relations) {
        const key = `${rel.from}|${rel.relationType}|${rel.to}`;
        if (!seenRelations.has(key)) {
          relations.push(rel);
          seenRelations.add(key);
        }
      }
    }

    if (op.type === 'add_observations' && op.payload.observations) {
      // Merge observations for same entity
      for (const obs of op.payload.observations) {
        const existing = observations.find(o => o.entityName === obs.entityName);
        if (existing) {
          existing.contents.push(...obs.contents);
        } else {
          observations.push({ ...obs });
        }
      }
    }
  }

  return { entities, relations, observations };
}

// =============================================================================
// MESSAGE GENERATION
// =============================================================================

/**
 * Generate a systemMessage for Claude to execute the graph operations
 */
function generateSystemMessage(aggregated: {
  entities: GraphEntity[];
  relations: GraphRelation[];
  observations: Array<{ entityName: string; contents: string[] }>;
}): string {
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
  // Read queued operations
  const operations = readQueuedOperations();

  if (operations.length === 0) {
    logHook('graph-queue-sync', 'No queued graph operations', 'debug');
    return outputSilentSuccess();
  }

  logHook('graph-queue-sync', `Processing ${operations.length} queued operations`, 'info');

  // Aggregate operations
  const aggregated = aggregateOperations(operations);

  // Generate system message
  const systemMessage = generateSystemMessage(aggregated);

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
export default graphQueueSync;
