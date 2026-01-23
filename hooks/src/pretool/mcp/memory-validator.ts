/**
 * Memory Knowledge Graph Validator Hook
 * Validates memory operations to prevent accidental data loss
 * CC 2.1.7 Compliant
 */

import type { HookInput, HookResult } from '../../types.js';
import {
  outputSilentSuccess,
  outputWarning,
  logHook,
  logPermissionFeedback,
} from '../../lib/common.js';

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

    default:
      // Read operations - always allow
      logPermissionFeedback('allow', `Read operation: ${toolName}`, input);
      break;
  }

  return outputSilentSuccess();
}
