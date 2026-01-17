#!/bin/bash
# Memory Bridge Hook - Bidirectional sync between Mem0 and Knowledge Graph
# Triggers on PostToolUse for mcp__mem0__add_memory and mcp__memory__create_entities
#
# Purpose: When memory is added to one system, suggest syncing to the other
#
# Mem0 -> Graph: Extract entities from text, suggest create_entities
# Graph -> Mem0: Format entities as natural language, suggest add_memory
#
# Version: 1.1.0 - CC 2.1.9/2.1.11 compliant
# CC 2.1.9: Uses systemMessage for actionable sync suggestions
# CC 2.1.11: Session ID guaranteed available (no fallback needed)
#
# Part of Memory Fabric v2.0 - Unified Memory System

set -euo pipefail

# Read stdin BEFORE sourcing libraries
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common library
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || {
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
}

# Source mem0 library (optional - graceful degradation)
MEM0_LIB="$SCRIPT_DIR/../_lib/mem0.sh"
HAS_MEM0_LIB=false
if [[ -f "$MEM0_LIB" ]]; then
    source "$MEM0_LIB" 2>/dev/null && HAS_MEM0_LIB=true
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${HOOK_LOG_DIR}/memory-bridge.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Entity type mapping patterns (Bash 3.2 compatible - no associative arrays)
ENTITY_TYPE_TECHNOLOGY="fastapi|react|typescript|python|postgres|redis|docker|kubernetes|langchain|langgraph|pgvector|qdrant|openai|anthropic|celery|rabbitmq|kafka|nginx|vite|tailwind|prisma|sqlalchemy|alembic|pydantic|zod"
ENTITY_TYPE_PATTERN="singleton|factory|repository|service|controller|adapter|facade|strategy|observer|decorator|middleware|dependency.injection|cursor.pagination|rate.limiting|circuit.breaker"
ENTITY_TYPE_DECISION="decided|chose|selected|will.use|adopted|standardized|migrated"
ENTITY_TYPE_ARCHITECTURE="microservice|monolith|event.driven|cqrs|event.sourcing|hexagonal|clean.architecture|ddd|api.gateway|load.balancer"
ENTITY_TYPE_DATABASE="postgresql|mysql|mongodb|sqlite|dynamodb|cassandra|schema|migration|index|query"
ENTITY_TYPE_SECURITY="jwt|oauth|cors|csrf|xss|sql.injection|rate.limit|encryption|authentication|authorization"

# Entity types list
ENTITY_TYPES="Technology Pattern Decision Architecture Database Security"

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------

log_bridge() {
    local msg="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [memory-bridge] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Entity Extraction from Text (Mem0 -> Graph)
# -----------------------------------------------------------------------------

get_pattern_for_type() {
    local entity_type="$1"
    case "$entity_type" in
        Technology) echo "$ENTITY_TYPE_TECHNOLOGY" ;;
        Pattern) echo "$ENTITY_TYPE_PATTERN" ;;
        Decision) echo "$ENTITY_TYPE_DECISION" ;;
        Architecture) echo "$ENTITY_TYPE_ARCHITECTURE" ;;
        Database) echo "$ENTITY_TYPE_DATABASE" ;;
        Security) echo "$ENTITY_TYPE_SECURITY" ;;
        *) echo "" ;;
    esac
}

extract_entities_from_text() {
    local text="$1"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local entities_json='[]'

    # Extract entities by type
    for entity_type in $ENTITY_TYPES; do
        local pattern
        pattern=$(get_pattern_for_type "$entity_type")
        [[ -z "$pattern" ]] && continue

        # Use grep with extended regex to find matches
        while IFS= read -r match; do
            if [[ -n "$match" ]]; then
                # Capitalize first letter for entity name (Bash 3.2 compatible)
                local entity_name
                entity_name=$(echo "$match" | awk '{for(i=1;i<=NF;i++)$i=toupper(substr($i,1,1))tolower(substr($i,2))}1' | tr ' ' '-')

                # Build observation from surrounding context
                local observation="Used in project context"
                if echo "$text_lower" | grep -qE "decided.*$match" 2>/dev/null; then
                    observation="Decided to use for project"
                elif echo "$text_lower" | grep -qE "chose.*$match" 2>/dev/null; then
                    observation="Chosen for implementation"
                elif echo "$text_lower" | grep -qE "will.use.*$match" 2>/dev/null; then
                    observation="Will be used in project"
                fi

                # Add to entities array
                entities_json=$(echo "$entities_json" | jq \
                    --arg name "$entity_name" \
                    --arg type "$entity_type" \
                    --arg obs "$observation" \
                    '. += [{"name": $name, "entityType": $type, "observations": [$obs]}]')
            fi
        done < <(echo "$text_lower" | grep -oE "$pattern" 2>/dev/null | sort -u | head -5)
    done

    echo "$entities_json"
}

# Extract relations from text
extract_relations_from_text() {
    local text="$1"
    local entities_json="$2"
    local text_lower
    text_lower=$(echo "$text" | tr '[:upper:]' '[:lower:]')

    local relations_json='[]'

    # Get entity names
    local entity_names
    entity_names=$(echo "$entities_json" | jq -r '.[].name' 2>/dev/null)

    # Look for relationship indicators
    while IFS= read -r entity1; do
        [[ -z "$entity1" ]] && continue
        local entity1_lower
        entity1_lower=$(echo "$entity1" | tr '[:upper:]' '[:lower:]' | tr '-' '.')

        while IFS= read -r entity2; do
            [[ -z "$entity2" ]] && continue
            [[ "$entity1" == "$entity2" ]] && continue

            local entity2_lower
            entity2_lower=$(echo "$entity2" | tr '[:upper:]' '[:lower:]' | tr '-' '.')

            # Check for relationship patterns
            if echo "$text_lower" | grep -qE "$entity1_lower.*(with|using|and|integrated|connected|for).*$entity2_lower" 2>/dev/null; then
                relations_json=$(echo "$relations_json" | jq \
                    --arg from "$entity1" \
                    --arg to "$entity2" \
                    '. += [{"from": $from, "to": $to, "relationType": "uses"}]')
            fi
        done <<< "$entity_names"
    done <<< "$entity_names"

    echo "$relations_json"
}

# -----------------------------------------------------------------------------
# Format Graph Entities as Natural Language (Graph -> Mem0)
# -----------------------------------------------------------------------------

format_entities_as_text() {
    local entities_json="$1"
    local formatted=""

    # Parse entities and build natural language
    local count
    count=$(echo "$entities_json" | jq 'length' 2>/dev/null || echo "0")

    if [[ "$count" -eq 0 ]]; then
        echo ""
        return
    fi

    # Build sentences from entities
    while IFS= read -r entity; do
        local name type observations
        name=$(echo "$entity" | jq -r '.name' 2>/dev/null)
        type=$(echo "$entity" | jq -r '.entityType' 2>/dev/null)
        observations=$(echo "$entity" | jq -r '.observations | join(". ")' 2>/dev/null)

        if [[ -n "$name" && "$name" != "null" ]]; then
            case "$type" in
                Technology)
                    formatted="${formatted}${name} is used as a technology in this project. ${observations}. "
                    ;;
                Pattern)
                    formatted="${formatted}The ${name} pattern is applied in this codebase. ${observations}. "
                    ;;
                Decision)
                    formatted="${formatted}Decision made regarding ${name}. ${observations}. "
                    ;;
                Architecture)
                    formatted="${formatted}${name} architectural approach is followed. ${observations}. "
                    ;;
                *)
                    formatted="${formatted}${name} (${type}): ${observations}. "
                    ;;
            esac
        fi
    done < <(echo "$entities_json" | jq -c '.[]' 2>/dev/null)

    echo "$formatted"
}

# -----------------------------------------------------------------------------
# Main Processing
# -----------------------------------------------------------------------------

TOOL_NAME=$(get_tool_name)

# Only process memory-related tools
case "$TOOL_NAME" in
    mcp__mem0__add_memory)
        # Mem0 -> Graph: Extract entities from added memory
        log_bridge "Processing mcp__mem0__add_memory for entity extraction"

        # Get the text that was added
        MEMORY_TEXT=$(get_field '.tool_input.text // ""')

        if [[ -z "$MEMORY_TEXT" || ${#MEMORY_TEXT} -lt 20 ]]; then
            log_bridge "Memory text too short, skipping"
            output_silent_success
            exit 0
        fi

        # Extract entities
        ENTITIES=$(extract_entities_from_text "$MEMORY_TEXT")
        ENTITY_COUNT=$(echo "$ENTITIES" | jq 'length' 2>/dev/null || echo "0")

        if [[ "$ENTITY_COUNT" -eq 0 || "$ENTITY_COUNT" == "null" ]]; then
            log_bridge "No entities extracted"
            output_silent_success
            exit 0
        fi

        # Extract relations
        RELATIONS=$(extract_relations_from_text "$MEMORY_TEXT" "$ENTITIES")
        RELATION_COUNT=$(echo "$RELATIONS" | jq 'length' 2>/dev/null || echo "0")

        log_bridge "Extracted $ENTITY_COUNT entities and $RELATION_COUNT relations"

        # Format suggestion message
        MSG=$(cat <<EOF
[Memory Bridge] Sync Suggestion: Mem0 -> Knowledge Graph

Detected ${ENTITY_COUNT} entities from memory text that could be synced to knowledge graph:

$(echo "$ENTITIES" | jq -r '.[] | "- \(.name) (\(.entityType)): \(.observations[0] // "observed")"' 2>/dev/null | head -5)

To sync, call mcp__memory__create_entities with:
\`\`\`json
{"entities": $(echo "$ENTITIES" | jq -c '.')}
\`\`\`
$(if [[ "$RELATION_COUNT" -gt 0 ]]; then echo "
Then call mcp__memory__create_relations with:
\`\`\`json
{\"relations\": $(echo "$RELATIONS" | jq -c '.')}
\`\`\`"; fi)
EOF
)

        jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
        exit 0
        ;;

    mcp__memory__create_entities)
        # Graph -> Mem0: Format entities as natural language for mem0
        log_bridge "Processing mcp__memory__create_entities for mem0 sync"

        # Get the entities that were created
        ENTITIES_INPUT=$(get_field '.tool_input.entities // "[]"')

        if [[ -z "$ENTITIES_INPUT" || "$ENTITIES_INPUT" == "[]" || "$ENTITIES_INPUT" == "null" ]]; then
            log_bridge "No entities to process"
            output_silent_success
            exit 0
        fi

        # Format as natural language
        FORMATTED_TEXT=$(format_entities_as_text "$ENTITIES_INPUT")

        if [[ -z "$FORMATTED_TEXT" ]]; then
            log_bridge "Could not format entities"
            output_silent_success
            exit 0
        fi

        # Get project-scoped user_id if mem0.sh is available
        USER_ID="default-user"
        if [[ "$HAS_MEM0_LIB" == "true" ]] && type mem0_user_id &>/dev/null; then
            USER_ID=$(mem0_user_id "patterns")
        fi

        log_bridge "Formatted entities for mem0 sync"

        # Format suggestion message
        MSG=$(cat <<EOF
[Memory Bridge] Sync Suggestion: Knowledge Graph -> Mem0

Created knowledge graph entities can be synced to Mem0 for semantic search:

Text: "${FORMATTED_TEXT:0:200}..."

To sync, call mcp__mem0__add_memory with:
\`\`\`json
{
  "text": "${FORMATTED_TEXT:0:500}",
  "user_id": "${USER_ID}",
  "metadata": {"source": "knowledge-graph-sync", "synced_at": "$(date -Iseconds)"},
  "enable_graph": true
}
\`\`\`
EOF
)

        jq -n --arg msg "$MSG" '{continue:true,systemMessage:$msg}'
        exit 0
        ;;

    *)
        # Not a memory tool, skip
        output_silent_success
        exit 0
        ;;
esac
