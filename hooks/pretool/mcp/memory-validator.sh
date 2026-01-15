#!/usr/bin/env bash
# CC 2.1.7 PreToolUse Hook: Memory Knowledge Graph Validator
# Validates memory operations to prevent accidental data loss
set -euo pipefail

# Read stdin once and cache
INPUT=$(cat)
export _HOOK_INPUT="$INPUT"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../../_lib/common.sh"

# Only process memory MCP calls
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
if [[ "$TOOL_NAME" != mcp__memory__* ]]; then
  output_silent_success
  exit 0
fi

# Track operation type
case "$TOOL_NAME" in
  mcp__memory__delete_entities)
    # Check for bulk deletion
    ENTITY_COUNT=$(echo "$INPUT" | jq -r '.tool_input.entityNames | length // 0')
    if [[ "$ENTITY_COUNT" -gt 5 ]]; then
      log_permission_feedback "memory" "warn" "Bulk delete: $ENTITY_COUNT entities"
      # Warn but allow - let user confirm
      jq -n --arg msg "⚠️ Warning: Deleting $ENTITY_COUNT entities from knowledge graph" \
        '{"continue": true, "suppressOutput": false, "hookSpecificOutput": {"systemMessage": $msg}}'
      exit 0
    fi
    ;;

  mcp__memory__delete_relations)
    # Check for bulk relation deletion
    RELATION_COUNT=$(echo "$INPUT" | jq -r '.tool_input.relations | length // 0')
    if [[ "$RELATION_COUNT" -gt 10 ]]; then
      log_permission_feedback "memory" "warn" "Bulk relation delete: $RELATION_COUNT relations"
      jq -n --arg msg "⚠️ Warning: Deleting $RELATION_COUNT relations from knowledge graph" \
        '{"continue": true, "suppressOutput": false, "hookSpecificOutput": {"systemMessage": $msg}}'
      exit 0
    fi
    ;;

  mcp__memory__create_entities)
    # Validate entity structure
    ENTITIES=$(echo "$INPUT" | jq -r '.tool_input.entities // []')
    ENTITY_COUNT=$(echo "$ENTITIES" | jq 'length')

    # Check each entity has required fields
    INVALID_COUNT=$(echo "$ENTITIES" | jq '[.[] | select(.name == null or .name == "" or .entityType == null or .entityType == "")] | length')
    if [[ "$INVALID_COUNT" -gt 0 ]]; then
      log_permission_feedback "memory" "warn" "Invalid entities: $INVALID_COUNT missing name or entityType"
      jq -n --arg msg "⚠️ Warning: $INVALID_COUNT entities missing required fields (name, entityType)" \
        '{"continue": true, "suppressOutput": false, "hookSpecificOutput": {"systemMessage": $msg}}'
      exit 0
    fi

    log_permission_feedback "memory" "allow" "Creating $ENTITY_COUNT valid entities"
    ;;

  mcp__memory__create_relations)
    # Validate relation structure
    RELATIONS=$(echo "$INPUT" | jq -r '.tool_input.relations // []')
    RELATION_COUNT=$(echo "$RELATIONS" | jq 'length')

    # Check each relation has required fields
    INVALID_COUNT=$(echo "$RELATIONS" | jq '[.[] | select(.from == null or .to == null or .relationType == null)] | length')
    if [[ "$INVALID_COUNT" -gt 0 ]]; then
      log_permission_feedback "memory" "warn" "Invalid relations: $INVALID_COUNT missing from/to/relationType"
      jq -n --arg msg "⚠️ Warning: $INVALID_COUNT relations missing required fields" \
        '{"continue": true, "suppressOutput": false, "hookSpecificOutput": {"systemMessage": $msg}}'
      exit 0
    fi

    log_permission_feedback "memory" "allow" "Creating $RELATION_COUNT valid relations"
    ;;

  *)
    # Read operations - always allow
    log_permission_feedback "memory" "allow" "Read operation: $TOOL_NAME"
    ;;
esac

output_silent_success