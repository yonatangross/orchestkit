/**
 * Memory Knowledge Graph Validator Hook
 * Validates memory operations to prevent accidental data loss
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputDeny,
  outputWarning,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';

// ---------------------------------------------------------------------------
// Size limits (OWASP ASI06 — prevent memory poisoning)
// ---------------------------------------------------------------------------
const MAX_ENTITY_NAME_LENGTH = 200;
const MAX_OBSERVATION_LENGTH = 1000;
const MAX_OBSERVATIONS_PER_ENTITY = 20;

// Known entity types — warn on unknown, don't block (types evolve)
const KNOWN_ENTITY_TYPES = new Set([
  'person', 'project', 'technology', 'concept', 'tool', 'pattern',
  'decision', 'preference', 'workflow', 'organization', 'service',
  'library', 'framework', 'language', 'file', 'module', 'api',
  'endpoint', 'database', 'config', 'environment', 'event',
]);

/**
 * Validate entity size constraints.
 * Returns deny message if oversized (likely poisoning attempt), null if OK.
 */
function validateEntitySizes(entities: Array<Record<string, unknown>>): string | null {
  for (const entity of entities) {
    const name = String(entity.name || '');
    if (name.length > MAX_ENTITY_NAME_LENGTH) {
      return `Entity name too long: ${name.length} chars (max ${MAX_ENTITY_NAME_LENGTH}). Oversized names may indicate a poisoning attempt.`;
    }

    const observations = entity.observations;
    if (Array.isArray(observations)) {
      if (observations.length > MAX_OBSERVATIONS_PER_ENTITY) {
        return `Too many observations for '${name.substring(0, 50)}': ${observations.length} (max ${MAX_OBSERVATIONS_PER_ENTITY}). Split into multiple entities.`;
      }
      for (const obs of observations) {
        const obsStr = String(obs);
        if (obsStr.length > MAX_OBSERVATION_LENGTH) {
          return `Observation too long for '${name.substring(0, 50)}': ${obsStr.length} chars (max ${MAX_OBSERVATION_LENGTH}). Summarize the observation.`;
        }
      }
    }
  }
  return null;
}

/**
 * Check for unknown entity types (warn, don't block).
 */
function checkEntityTypes(entities: Array<Record<string, unknown>>): string[] {
  const unknownTypes: string[] = [];
  for (const entity of entities) {
    const entityType = String(entity.entityType || '').toLowerCase();
    if (entityType && !KNOWN_ENTITY_TYPES.has(entityType)) {
      unknownTypes.push(entityType);
    }
  }
  return unknownTypes;
}

/**
 * Validate observation sizes for add_observations.
 */
function validateObservationSizes(observationsInput: Array<Record<string, unknown>>): string | null {
  for (const entry of observationsInput) {
    const contents = entry.contents;
    if (Array.isArray(contents)) {
      if (contents.length > MAX_OBSERVATIONS_PER_ENTITY) {
        return `Too many observations in batch: ${contents.length} (max ${MAX_OBSERVATIONS_PER_ENTITY}).`;
      }
      for (const obs of contents) {
        const obsStr = String(obs);
        if (obsStr.length > MAX_OBSERVATION_LENGTH) {
          return `Observation too long: ${obsStr.length} chars (max ${MAX_OBSERVATION_LENGTH}). Summarize the observation.`;
        }
      }
    }
  }
  return null;
}

/**
 * Memory validator - validates memory operations
 */
export function memoryValidator(input: HookInput): HookResult {
  const toolName = input.tool_name || '';

  // Only process memory MCP calls
  if (!toolName.startsWith('mcp__memory__')) {
    return outputSilentSuccess();
  }

  switch (toolName) {
    case 'mcp__memory__delete_entities': {
      // Check for bulk deletion
      const entityNames = input.tool_input.entityNames;
      const entityCount = Array.isArray(entityNames) ? entityNames.length : 0;

      if (entityCount > 5) {
        logPermissionFeedback('warn', `Bulk delete: ${entityCount} entities`, input);
        logHook('memory-validator', `WARN: Bulk entity delete: ${entityCount} entities`);

        // Warn but allow - let user confirm
        return outputWarning(`Deleting ${entityCount} entities from knowledge graph`);
      }
      break;
    }

    case 'mcp__memory__delete_relations': {
      // Check for bulk relation deletion
      const relations = input.tool_input.relations;
      const relationCount = Array.isArray(relations) ? relations.length : 0;

      if (relationCount > 10) {
        logPermissionFeedback('warn', `Bulk relation delete: ${relationCount} relations`, input);
        logHook('memory-validator', `WARN: Bulk relation delete: ${relationCount} relations`);

        return outputWarning(`Deleting ${relationCount} relations from knowledge graph`);
      }
      break;
    }

    case 'mcp__memory__create_entities': {
      // Validate entity structure
      const entities = input.tool_input.entities;
      if (!Array.isArray(entities)) {
        logPermissionFeedback('allow', 'Creating entities (non-array input)', input);
        return outputSilentSuccess();
      }

      const entityCount = entities.length;

      // Check each entity has required fields
      const invalidCount = entities.filter(
        (e: Record<string, unknown>) => !e.name || e.name === '' || !e.entityType || e.entityType === ''
      ).length;

      if (invalidCount > 0) {
        logPermissionFeedback('warn', `Invalid entities: ${invalidCount} missing name or entityType`, input);
        logHook('memory-validator', `WARN: ${invalidCount} entities missing required fields`);

        return outputWarning(`${invalidCount} entities missing required fields (name, entityType)`);
      }

      // Size validation — block oversized (likely poisoning per OWASP ASI06)
      const sizeError = validateEntitySizes(entities as Array<Record<string, unknown>>);
      if (sizeError) {
        logPermissionFeedback('deny', `Oversized entity: ${sizeError}`, input);
        logHook('memory-validator', `BLOCKED: ${sizeError}`);
        return outputDeny(sizeError);
      }

      // Unknown entity type warning (don't block — types evolve)
      const unknownTypes = checkEntityTypes(entities as Array<Record<string, unknown>>);
      if (unknownTypes.length > 0) {
        logHook('memory-validator', `WARN: Unknown entity types: ${unknownTypes.join(', ')}`);
      }

      logPermissionFeedback('allow', `Creating ${entityCount} valid entities`, input);
      break;
    }

    case 'mcp__memory__create_relations': {
      // Validate relation structure
      const relations = input.tool_input.relations;
      if (!Array.isArray(relations)) {
        logPermissionFeedback('allow', 'Creating relations (non-array input)', input);
        return outputSilentSuccess();
      }

      const relationCount = relations.length;

      // Check each relation has required fields
      const invalidCount = relations.filter(
        (r: Record<string, unknown>) => !r.from || !r.to || !r.relationType
      ).length;

      if (invalidCount > 0) {
        logPermissionFeedback('warn', `Invalid relations: ${invalidCount} missing from/to/relationType`, input);
        logHook('memory-validator', `WARN: ${invalidCount} relations missing required fields`);

        return outputWarning(`${invalidCount} relations missing required fields`);
      }

      logPermissionFeedback('allow', `Creating ${relationCount} valid relations`, input);
      break;
    }

    case 'mcp__memory__add_observations': {
      // Validate observation sizes
      const observations = input.tool_input.observations;
      if (Array.isArray(observations)) {
        const obsError = validateObservationSizes(observations as Array<Record<string, unknown>>);
        if (obsError) {
          logPermissionFeedback('deny', `Oversized observation: ${obsError}`, input);
          logHook('memory-validator', `BLOCKED: ${obsError}`);
          return outputDeny(obsError);
        }
      }
      logPermissionFeedback('allow', `Adding observations`, input);
      break;
    }

    default:
      // Read operations - always allow
      logPermissionFeedback('allow', `Read operation: ${toolName}`, input);
      break;
  }

  return outputSilentSuccess();
}
