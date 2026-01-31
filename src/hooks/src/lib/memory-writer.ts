/**
 * Unified Memory Writer - Store decisions to local graph and mem0 cloud
 *
 * Part of Intelligent Decision Capture System
 *
 * Purpose:
 * - Unify storage to local graph memory (PRIMARY)
 * - Store backup to local JSON files
 * - Optionally sync to mem0 cloud (when MEM0_API_KEY is set)
 * - Build rich graph relationships (CHOSE, CHOSE_OVER, CONSTRAINT)
 * - Support cross-project best practices sharing via user identity
 *
 * Storage Tiers:
 * 1. Local JSON (always) - .claude/memory/*.jsonl
 * 2. Local Graph (if available) - mcp__memory__* operations queued
 * 3. Mem0 Cloud (optional) - when MEM0_API_KEY env var is set
 *
 * Sharing Scopes:
 * - local: Current session only
 * - user: User's personal profile
 * - team: Shared within project/team
 * - global: Cross-project best practices (anonymized)
 *
 * CC 2.1.16 Compliant
 */

import { existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { getProjectDir, logHook } from './common.js';
import {
  getIdentityContext,
  canShare,
  getUserIdForScope,
  getProjectUserId,
  getGlobalScopeId,
} from './user-identity.js';
import {
  trackDecisionMade,
  trackPreferenceStated,
} from './session-tracker.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Sharing scope for decisions
 */
export type SharingScope = 'local' | 'user' | 'team' | 'global';

/**
 * Decision record for storage
 */
export interface DecisionRecord {
  /** Unique ID */
  id: string;
  /** Record type */
  type: 'decision' | 'preference' | 'problem-solution' | 'pattern' | 'workflow';
  /** Main content */
  content: {
    /** What was decided */
    what: string;
    /** Why it was decided (rationale) */
    why?: string;
    /** Alternatives considered */
    alternatives?: string[];
    /** Constraints that influenced the decision */
    constraints?: string[];
    /** Tradeoffs accepted */
    tradeoffs?: string[];
  };
  /** Mentioned entities (technologies, patterns, tools) */
  entities: string[];
  /** Graph relations to create */
  relations: Array<{
    from: string;
    to: string;
    type: RelationType;
  }>;
  /** User identity context */
  identity: {
    /** User ID (email or anonymous) */
    user_id: string;
    /** Anonymous ID for global sharing */
    anonymous_id: string;
    /** Team/org ID if known */
    team_id?: string;
    /** Machine ID */
    machine_id: string;
  };
  /** Metadata */
  metadata: {
    session_id: string;
    timestamp: string;
    confidence: number;
    source: DecisionSource;
    project: string;
    category: string;
    importance?: 'high' | 'medium' | 'low';
    /** Is this pattern generalizable across projects? */
    is_generalizable?: boolean;
    /** Maximum scope this can be shared to */
    sharing_scope?: SharingScope;
  };
}

/**
 * Source of the decision
 */
export type DecisionSource =
  | 'user_prompt'
  | 'tool_output'
  | 'flow_inference'
  | 'skill_output'
  | 'git_commit';

/**
 * Relation types for graph
 */
export type RelationType =
  | 'CHOSE'
  | 'CHOSE_OVER'
  | 'MENTIONS'
  | 'CONSTRAINT'
  | 'TRADEOFF'
  | 'RELATES_TO'
  | 'SOLVED_BY'
  | 'PREFERS';

/**
 * Graph entity for memory storage
 */
export interface GraphEntity {
  name: string;
  entityType: EntityType;
  observations: string[];
}

/**
 * Entity types for graph
 */
export type EntityType =
  | 'Decision'
  | 'Preference'
  | 'Problem'
  | 'Solution'
  | 'Technology'
  | 'Pattern'
  | 'Tool'
  | 'Workflow';

/**
 * Graph relation for memory storage
 */
export interface GraphRelation {
  from: string;
  to: string;
  relationType: RelationType;
}

/**
 * Queued operation for graph memory
 */
export interface QueuedGraphOperation {
  type: 'create_entities' | 'create_relations' | 'add_observations';
  payload: {
    entities?: GraphEntity[];
    relations?: GraphRelation[];
    observations?: Array<{ entityName: string; contents: string[] }>;
  };
  timestamp: string;
}

// =============================================================================
// FILE PATHS
// =============================================================================

/**
 * Get path to decisions storage file
 */
function getDecisionsPath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'decisions.jsonl');
}

/**
 * Get path to graph operations queue
 */
function getGraphQueuePath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'graph-queue.jsonl');
}

/**
 * Get path to mem0 queue (for async sync)
 */
function getMem0QueuePath(): string {
  return join(getProjectDir(), '.claude', 'memory', 'mem0-queue.jsonl');
}

// =============================================================================
// LOCAL STORAGE
// =============================================================================

/**
 * Append record to JSONL file
 */
function appendToJsonl(filePath: string, record: unknown): boolean {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(record) + '\n';
    appendFileSync(filePath, line);
    return true;
  } catch (err) {
    logHook('memory-writer', `Failed to write to ${filePath}: ${err}`, 'warn');
    return false;
  }
}

/**
 * Store decision to local JSON backup
 */
function storeToLocalJson(decision: DecisionRecord): boolean {
  return appendToJsonl(getDecisionsPath(), decision);
}

// =============================================================================
// GRAPH OPERATIONS
// =============================================================================

/**
 * Build graph operations from a decision record
 */
export function buildGraphOperations(decision: DecisionRecord): QueuedGraphOperation[] {
  const operations: QueuedGraphOperation[] = [];
  const timestamp = new Date().toISOString();

  // 1. Create main decision/preference entity
  const mainEntity: GraphEntity = {
    name: decision.id,
    entityType: capitalizeEntityType(decision.type),
    observations: buildObservations(decision),
  };

  // 2. Create entities for mentioned technologies/patterns
  const entityEntities: GraphEntity[] = decision.entities.map(e => ({
    name: e,
    entityType: inferEntityType(e),
    observations: [`Mentioned in ${decision.type}: ${decision.content.what.slice(0, 100)}`],
  }));

  operations.push({
    type: 'create_entities',
    payload: {
      entities: [mainEntity, ...entityEntities],
    },
    timestamp,
  });

  // 3. Create relations
  const relations: GraphRelation[] = [];

  // Link decision to entities with CHOSE, or preferences with PREFERS
  for (const entity of decision.entities) {
    const relationType: RelationType =
      decision.type === 'decision' ? 'CHOSE'
      : decision.type === 'preference' ? 'PREFERS'
      : 'MENTIONS';
    relations.push({
      from: decision.id,
      to: entity,
      relationType,
    });
  }

  // Create CHOSE_OVER relations for alternatives
  if (decision.content.alternatives?.length) {
    for (const alt of decision.content.alternatives) {
      relations.push({
        from: decision.content.what,
        to: alt,
        relationType: 'CHOSE_OVER',
      });
    }
  }

  // Create CONSTRAINT relations
  if (decision.content.constraints?.length) {
    for (const constraint of decision.content.constraints) {
      relations.push({
        from: decision.id,
        to: constraint,
        relationType: 'CONSTRAINT',
      });
    }
  }

  // Create TRADEOFF relations
  if (decision.content.tradeoffs?.length) {
    for (const tradeoff of decision.content.tradeoffs) {
      relations.push({
        from: decision.id,
        to: tradeoff,
        relationType: 'TRADEOFF',
      });
    }
  }

  // Create RELATES_TO between co-occurring entities (cross-links)
  if (decision.entities.length >= 2) {
    for (let i = 0; i < decision.entities.length; i++) {
      for (let j = i + 1; j < decision.entities.length; j++) {
        relations.push({
          from: decision.entities[i],
          to: decision.entities[j],
          relationType: 'RELATES_TO',
        });
      }
    }
  }

  // Add any explicit relations from the record
  for (const rel of decision.relations) {
    relations.push({
      from: rel.from,
      to: rel.to,
      relationType: rel.type,
    });
  }

  if (relations.length > 0) {
    operations.push({
      type: 'create_relations',
      payload: { relations },
      timestamp,
    });
  }

  return operations;
}

/**
 * Build observations list from decision
 */
function buildObservations(decision: DecisionRecord): string[] {
  const obs: string[] = [];

  obs.push(`What: ${decision.content.what}`);

  if (decision.content.why) {
    obs.push(`Rationale: ${decision.content.why}`);
  }

  if (decision.content.alternatives?.length) {
    obs.push(`Alternatives considered: ${decision.content.alternatives.join(', ')}`);
  }

  if (decision.content.constraints?.length) {
    obs.push(`Constraints: ${decision.content.constraints.join('; ')}`);
  }

  if (decision.content.tradeoffs?.length) {
    obs.push(`Tradeoffs: ${decision.content.tradeoffs.join('; ')}`);
  }

  obs.push(`Category: ${decision.metadata.category}`);
  obs.push(`Confidence: ${(decision.metadata.confidence * 100).toFixed(0)}%`);
  obs.push(`Source: ${decision.metadata.source}`);
  obs.push(`Project: ${decision.metadata.project}`);
  obs.push(`Timestamp: ${decision.metadata.timestamp}`);

  return obs;
}

/**
 * Capitalize entity type for graph
 */
function capitalizeEntityType(type: string): EntityType {
  const typeMap: Record<string, EntityType> = {
    'decision': 'Decision',
    'preference': 'Preference',
    'problem-solution': 'Solution',
    'pattern': 'Pattern',
    'workflow': 'Workflow',
  };
  return typeMap[type] || 'Decision';
}

/**
 * Infer entity type from name
 */
function inferEntityType(name: string): EntityType {
  const nameLower = name.toLowerCase();

  // Technologies
  const techs = [
    'postgresql', 'postgres', 'redis', 'mongodb', 'fastapi', 'django', 'react',
    'vue', 'angular', 'typescript', 'python', 'docker', 'kubernetes',
  ];
  if (techs.some(t => nameLower.includes(t))) {
    return 'Technology';
  }

  // Patterns
  const patterns = [
    'pagination', 'pattern', 'architecture', 'cqrs', 'saga', 'circuit',
    'injection', 'sourcing', 'caching', 'rag',
  ];
  if (patterns.some(p => nameLower.includes(p))) {
    return 'Pattern';
  }

  // Tools
  const tools = ['grep', 'read', 'write', 'bash', 'git', 'npm', 'jest', 'pytest'];
  if (tools.some(t => nameLower.includes(t))) {
    return 'Tool';
  }

  return 'Technology'; // Default
}

/**
 * Queue graph operation for later processing
 */
export function queueGraphOperation(operation: QueuedGraphOperation): boolean {
  return appendToJsonl(getGraphQueuePath(), operation);
}

// =============================================================================
// MEM0 OPERATIONS
// =============================================================================

/**
 * Check if mem0 is configured
 */
export function isMem0Configured(): boolean {
  return !!process.env.MEM0_API_KEY;
}

/**
 * Build mem0 memory payload from decision
 * Uses appropriate user_id scope based on sharing settings
 */
function buildMem0Payload(decision: DecisionRecord): Record<string, unknown> {
  const scope = decision.metadata.sharing_scope || 'team';
  const isGeneralizable = decision.metadata.is_generalizable || false;

  // Determine the appropriate user_id based on scope and privacy
  let userId: string;
  if (scope === 'global' && isGeneralizable && canShare('decisions', 'global')) {
    // Use global best practices scope (anonymized)
    userId = getGlobalScopeId('best-practices');
  } else if (canShare('decisions', 'team')) {
    // Use project-scoped ID
    userId = getProjectUserId('decisions');
  } else {
    // Fallback to user-scoped
    userId = `${getUserIdForScope('local')}-decisions`;
  }

  return {
    text: `${decision.type}: ${decision.content.what}${decision.content.why ? ` because ${decision.content.why}` : ''}`,
    user_id: userId,
    metadata: {
      type: decision.type,
      category: decision.metadata.category,
      confidence: decision.metadata.confidence,
      source: decision.metadata.source,
      project: decision.metadata.project,
      timestamp: decision.metadata.timestamp,
      entities: decision.entities,
      has_rationale: !!decision.content.why,
      has_alternatives: !!decision.content.alternatives?.length,
      importance: decision.metadata.importance,
      is_generalizable: isGeneralizable,
      // Include identity for attribution (anonymized if global)
      contributor_id: scope === 'global' ? decision.identity.anonymous_id : decision.identity.user_id,
    },
  };
}

/**
 * Queue for mem0 async sync
 */
function queueForMem0(decision: DecisionRecord): boolean {
  if (!isMem0Configured()) {
    return false;
  }

  const payload = buildMem0Payload(decision);
  return appendToJsonl(getMem0QueuePath(), {
    ...payload,
    queued_at: new Date().toISOString(),
  });
}

// =============================================================================
// MAIN STORAGE FUNCTION
// =============================================================================

/**
 * Store a decision to all configured storage backends
 *
 * @param decision - The decision record to store
 * @returns Object indicating which backends succeeded
 */
export async function storeDecision(decision: DecisionRecord): Promise<{
  local: boolean;
  graph_queued: boolean;
  mem0_queued: boolean;
}> {
  const result = {
    local: false,
    graph_queued: false,
    mem0_queued: false,
  };

  // 1. Store to local JSON (always, primary backup)
  result.local = storeToLocalJson(decision);

  // 2. Queue graph operations
  const graphOps = buildGraphOperations(decision);
  let graphQueued = true;
  for (const op of graphOps) {
    if (!queueGraphOperation(op)) {
      graphQueued = false;
    }
  }
  result.graph_queued = graphQueued;

  // 3. Queue for mem0 (if configured)
  if (isMem0Configured()) {
    result.mem0_queued = queueForMem0(decision);
  }

  // Log result
  const backends = [
    result.local ? 'local' : null,
    result.graph_queued ? 'graph' : null,
    result.mem0_queued ? 'mem0' : null,
  ].filter(Boolean);

  if (backends.length > 0) {
    logHook(
      'memory-writer',
      `Stored ${decision.type} ${decision.id} to: ${backends.join(', ')}`,
      'info'
    );
  }

  return result;
}

/**
 * Determine if a decision is generalizable (can be shared globally)
 */
function isGeneralizable(
  content: DecisionRecord['content'],
  confidence: number,
  entities: string[]
): boolean {
  // High confidence decisions with rationale are more generalizable
  if (confidence < 0.8) return false;
  if (!content.why) return false;

  // Must mention at least one well-known technology/pattern
  const generalPatterns = [
    'pagination', 'caching', 'authentication', 'authorization', 'testing',
    'deployment', 'security', 'performance', 'database', 'api', 'architecture',
  ];
  const hasGeneralPattern = entities.some(e =>
    generalPatterns.some(p => e.toLowerCase().includes(p))
  );

  return hasGeneralPattern;
}

/**
 * Create a decision record from basic inputs
 */
export function createDecisionRecord(
  type: DecisionRecord['type'],
  content: DecisionRecord['content'],
  entities: string[],
  metadata: Partial<DecisionRecord['metadata']> & {
    session_id: string;
    source: DecisionSource;
  }
): DecisionRecord {
  const timestamp = new Date().toISOString();
  const id = generateId(type);
  const project = getProjectDir().split('/').pop() || 'unknown';
  const identityCtx = getIdentityContext();
  const confidence = metadata.confidence ?? 0.5;

  // Determine if this can be shared globally
  const generalizable = isGeneralizable(content, confidence, entities);

  // Track in session (for profile aggregation)
  if (type === 'decision') {
    trackDecisionMade(content.what, content.why, confidence);
  } else if (type === 'preference') {
    trackPreferenceStated(content.what, confidence);
  }

  return {
    id,
    type,
    content,
    entities,
    relations: [], // Will be built automatically from content
    identity: {
      user_id: identityCtx.user_id,
      anonymous_id: identityCtx.anonymous_id,
      team_id: identityCtx.team_id,
      machine_id: identityCtx.machine_id,
    },
    metadata: {
      session_id: metadata.session_id,
      timestamp,
      confidence,
      source: metadata.source,
      project,
      category: metadata.category ?? 'general',
      importance: metadata.importance,
      is_generalizable: generalizable,
      sharing_scope: generalizable ? 'global' : 'team',
    },
  };
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
