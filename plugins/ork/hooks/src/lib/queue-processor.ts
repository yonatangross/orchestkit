/**
 * Queue Processor - Shared queue reading/processing functions
 *
 * Extracted from stop/graph-queue-sync.ts and stop/mem0-queue-sync.ts
 * to enable reuse in prompt/queue-recovery.ts
 */

import { existsSync, readFileSync, unlinkSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { logHook } from './common.js';
import type { QueuedGraphOperation, GraphEntity, GraphRelation } from './memory-writer.js';

// Re-export types needed by consumers
export type { QueuedGraphOperation, GraphEntity, GraphRelation };

// =============================================================================
// TYPES
// =============================================================================

/**
 * Queued mem0 memory payload (from memory-writer.ts:queueForMem0)
 */
export interface QueuedMem0Memory {
  text: string;
  user_id: string;
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
  queued_at: string;
}

/**
 * Aggregated graph operations (deduplicated)
 */
export interface AggregatedGraphOps {
  entities: GraphEntity[];
  relations: GraphRelation[];
  observations: Array<{ entityName: string; contents: string[] }>;
}

// =============================================================================
// QUEUE READING
// =============================================================================

/**
 * Read mem0 queue entries from a JSONL file
 */
export function readMem0Queue(queuePath: string): QueuedMem0Memory[] {
  if (!existsSync(queuePath)) return [];

  try {
    const content = readFileSync(queuePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const memories: QueuedMem0Memory[] = [];

    for (const line of lines) {
      try {
        const memory = JSON.parse(line) as QueuedMem0Memory;
        if (memory.text && memory.user_id) {
          memories.push(memory);
        } else {
          logHook('queue-processor', 'Skipping invalid mem0 memory (missing text or user_id)', 'warn');
        }
      } catch {
        logHook('queue-processor', `Failed to parse mem0 queue line: ${line.slice(0, 100)}`, 'warn');
      }
    }

    return memories;
  } catch (error) {
    logHook('queue-processor', `Failed to read mem0 queue: ${error}`, 'warn');
    return [];
  }
}

/**
 * Deduplicate mem0 memories by text (keep most recent)
 */
export function deduplicateMem0Memories(memories: QueuedMem0Memory[]): QueuedMem0Memory[] {
  const seen = new Map<string, QueuedMem0Memory>();

  for (const memory of memories) {
    const key = memory.text.trim().toLowerCase();
    const existing = seen.get(key);
    if (!existing || memory.queued_at > existing.queued_at) {
      seen.set(key, memory);
    }
  }

  return Array.from(seen.values());
}

/**
 * Read graph queue entries from a JSONL file
 */
export function readGraphQueue(queuePath: string): QueuedGraphOperation[] {
  if (!existsSync(queuePath)) return [];

  try {
    const content = readFileSync(queuePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    const operations: QueuedGraphOperation[] = [];

    for (const line of lines) {
      try {
        const op = JSON.parse(line) as QueuedGraphOperation;
        operations.push(op);
      } catch {
        logHook('queue-processor', `Failed to parse graph queue line: ${line.slice(0, 100)}`, 'warn');
      }
    }

    return operations;
  } catch (error) {
    logHook('queue-processor', `Failed to read graph queue: ${error}`, 'warn');
    return [];
  }
}

/**
 * Aggregate graph operations, deduplicating entities and relations
 */
export function aggregateGraphOperations(operations: QueuedGraphOperation[]): AggregatedGraphOps {
  const entities: GraphEntity[] = [];
  const relations: GraphRelation[] = [];
  const observations: Array<{ entityName: string; contents: string[] }> = [];

  const seenEntities = new Set<string>();
  const seenRelations = new Set<string>();

  for (const op of operations) {
    if (op.type === 'create_entities' && op.payload?.entities) {
      for (const entity of op.payload.entities) {
        if (!seenEntities.has(entity.name)) {
          entities.push(entity);
          seenEntities.add(entity.name);
        }
      }
    }

    if (op.type === 'create_relations' && op.payload?.relations) {
      for (const rel of op.payload.relations) {
        const key = `${rel.from}|${rel.relationType}|${rel.to}`;
        if (!seenRelations.has(key)) {
          relations.push(rel);
          seenRelations.add(key);
        }
      }
    }

    if (op.type === 'add_observations' && op.payload?.observations) {
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
// QUEUE MANAGEMENT
// =============================================================================

/**
 * Clear (delete) a queue file
 */
export function clearQueueFile(queuePath: string): void {
  if (!existsSync(queuePath)) return;

  try {
    unlinkSync(queuePath);
    logHook('queue-processor', `Cleared queue: ${queuePath}`, 'debug');
  } catch (error) {
    logHook('queue-processor', `Failed to clear queue ${queuePath}: ${error}`, 'warn');
  }
}

/**
 * Check if a queue file is stale (older than maxAgeMs)
 */
export function isQueueStale(queuePath: string, maxAgeMs: number): boolean {
  if (!existsSync(queuePath)) return false;

  try {
    const stat = statSync(queuePath);
    const age = Date.now() - stat.mtime.getTime();
    return age > maxAgeMs;
  } catch {
    return false;
  }
}

/**
 * Archive a queue file by moving it to an archive directory
 */
export function archiveQueue(queuePath: string, archiveDir: string): void {
  if (!existsSync(queuePath)) return;

  try {
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = basename(queuePath) || 'queue.jsonl';
    const archivePath = join(archiveDir, `${timestamp}-${filename}`);

    renameSync(queuePath, archivePath);
    logHook('queue-processor', `Archived queue to ${archivePath}`, 'info');
  } catch (error) {
    logHook('queue-processor', `Failed to archive queue: ${error}`, 'warn');
    // Fallback: just clear it
    clearQueueFile(queuePath);
  }
}
