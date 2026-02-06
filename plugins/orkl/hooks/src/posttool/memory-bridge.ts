/**
 * Memory Bridge Hook - Graph-First Memory Sync
 * Triggers on PostToolUse for mcp__memory__create_entities
 *
 * Graph-First Architecture (v2.1):
 * - Graph (mcp__memory__*) is AUTHORITATIVE - always the source of truth
 * - Mem0 cloud uses CLI scripts (not MCP) for semantic search
 * - When graph is used (default), NO sync needed (already in primary)
 *
 * Note: Mem0 MCP tools are deprecated. Use CLI scripts at:
 * ${CLAUDE_PLUGIN_ROOT}/src/skills/mem0-memory/scripts/
 *
 * Version: 2.1.2 - CLI-based mem0, MCP for graph only
 * Part of Memory Fabric v2.1 - Graph-First Architecture
 */

import { existsSync } from 'node:fs';
import type { HookInput, HookResult } from '../types.js';
import { outputSilentSuccess, getField, getPluginRoot, logHook } from '../lib/common.js';

// Entity type mapping patterns
const ENTITY_PATTERNS: Record<string, RegExp> = {
  Technology: /fastapi|react|typescript|python|postgres|redis|docker|kubernetes|langchain|langgraph|pgvector|qdrant|openai|anthropic|celery|rabbitmq|kafka|nginx|vite|tailwind|prisma|sqlalchemy|alembic|pydantic|zod/i,
  Pattern: /singleton|factory|repository|service|controller|adapter|facade|strategy|observer|decorator|middleware|dependency.injection|cursor.pagination|rate.limiting|circuit.breaker/i,
  Decision: /decided|chose|selected|will.use|adopted|standardized|migrated/i,
  Architecture: /microservice|monolith|event.driven|cqrs|event.sourcing|hexagonal|clean.architecture|ddd|api.gateway|load.balancer/i,
  Database: /postgresql|mysql|mongodb|sqlite|dynamodb|cassandra|schema|migration|index|query/i,
  Security: /jwt|oauth|cors|csrf|xss|sql.injection|rate.limit|encryption|authentication|authorization/i,
};

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
}

/**
 * Extract entities from text (Mem0 -> Graph)
 */
function extractEntitiesFromText(text: string): Entity[] {
  const textLower = text.toLowerCase();
  const entities: Entity[] = [];

  for (const [entityType, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const matches = textLower.match(pattern);
    if (matches) {
      for (const match of [...new Set(matches)].slice(0, 5)) {
        // Capitalize first letter for entity name
        const entityName = match
          .split(/[\s-_]+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join('-');

        // Build observation from surrounding context
        let observation = 'Used in project context';
        if (/decided.*/.test(textLower) && textLower.includes(match)) {
          observation = 'Decided to use for project';
        } else if (/chose.*/.test(textLower) && textLower.includes(match)) {
          observation = 'Chosen for implementation';
        } else if (/will.use.*/.test(textLower) && textLower.includes(match)) {
          observation = 'Will be used in project';
        }

        entities.push({
          name: entityName,
          entityType,
          observations: [observation],
        });
      }
    }
  }

  return entities;
}

/**
 * Extract relations from text
 */
function extractRelationsFromText(text: string, entities: Entity[]): Relation[] {
  const textLower = text.toLowerCase();
  const relations: Relation[] = [];
  const entityNames = entities.map(e => e.name);

  for (const entity1 of entityNames) {
    const entity1Lower = entity1.toLowerCase().replace(/-/g, '.');

    for (const entity2 of entityNames) {
      if (entity1 === entity2) continue;

      const entity2Lower = entity2.toLowerCase().replace(/-/g, '.');
      const relationPattern = new RegExp(
        `${entity1Lower}.*(with|using|and|integrated|connected|for).*${entity2Lower}`,
        'i'
      );

      if (relationPattern.test(textLower)) {
        relations.push({
          from: entity1,
          to: entity2,
          relationType: 'uses',
        });
      }
    }
  }

  return relations;
}

/**
 * Sync memory operations (Graph-First Architecture)
 * Note: Mem0 now uses CLI scripts, so only graph operations trigger this hook
 */
export function memoryBridge(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process memory-related tools
  switch (toolName) {
    case 'mcp__memory__create_entities':
      // Graph-First: No sync needed when writing to graph (it's already the primary)
      logHook('memory-bridge', 'mcp__memory__create_entities - graph is primary, no sync needed');
      return outputSilentSuccess();

    default:
      // Not a memory tool, skip
      return outputSilentSuccess();
  }
}
