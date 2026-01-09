#!/bin/bash
# Context Loader - Session Start Hook
# Loads essential context with attention-aware positioning
#
# ATTENTION POSITIONING:
# - START (high attention): identity, decisions, knowledge index
# - MIDDLE (lower attention): patterns, agent context
# - END (high attention): blockers, session state
#
# Version: 2.0.0
# Part of Context Engineering 2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/context"
LOG_FILE="$PROJECT_ROOT/logs/context-loader.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Token estimation (rough: ~4 chars per token)
estimate_tokens() {
    local file=$1
    if [ -f "$file" ]; then
        local chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Main context loading function
load_context() {
    local total_tokens=0
    local output=""

    log "Starting context load..."

    # ═══════════════════════════════════════════════════════════════
    # POSITION: START (High Attention)
    # ═══════════════════════════════════════════════════════════════

    # 1. Load identity (ALWAYS, ~150 tokens)
    if [ -f "$CONTEXT_DIR/identity.json" ]; then
        local identity=$(jq -c '{
            project: .project.name,
            version: .project.version,
            constraints: .constraints,
            tech_stack: {
                backend: .tech_stack.backend.framework,
                frontend: .tech_stack.frontend.framework,
                database: .tech_stack.database.primary
            }
        }' "$CONTEXT_DIR/identity.json" 2>/dev/null || echo '{}')

        if [ "$identity" != "{}" ]; then
            output="[IDENTITY]\n$identity\n\n"
            local tokens=$(estimate_tokens "$CONTEXT_DIR/identity.json")
            total_tokens=$((total_tokens + tokens))
            log "Loaded identity.json (~$tokens tokens)"
        fi
    fi

    # 2. Load knowledge index (ALWAYS, ~100 tokens)
    if [ -f "$CONTEXT_DIR/knowledge/index.json" ]; then
        local index=$(jq -c '.available_knowledge | to_entries | map({
            key: .key,
            triggers: .value.triggers[0:3],
            tokens: .value.token_estimate
        })' "$CONTEXT_DIR/knowledge/index.json" 2>/dev/null || echo '[]')

        if [ "$index" != "[]" ]; then
            output="$output[AVAILABLE_KNOWLEDGE]\n$index\n\n"
            local tokens=$(estimate_tokens "$CONTEXT_DIR/knowledge/index.json")
            total_tokens=$((total_tokens + tokens / 2))  # Only loading summary
            log "Loaded knowledge index (~$((tokens / 2)) tokens)"
        fi
    fi

    # ═══════════════════════════════════════════════════════════════
    # POSITION: END (High Attention)
    # ═══════════════════════════════════════════════════════════════

    # 3. Load blockers if any exist (conditional, ~100 tokens)
    if [ -f "$CONTEXT_DIR/knowledge/blockers/current.json" ]; then
        local blockers=$(jq -c '.blockers' "$CONTEXT_DIR/knowledge/blockers/current.json" 2>/dev/null || echo '[]')

        if [ "$blockers" != "[]" ] && [ "$blockers" != "null" ]; then
            output="$output[ACTIVE_BLOCKERS]\n$blockers\n\n"
            local tokens=$(estimate_tokens "$CONTEXT_DIR/knowledge/blockers/current.json")
            total_tokens=$((total_tokens + tokens))
            log "Loaded blockers (~$tokens tokens) - ATTENTION: Active blockers exist!"
        fi
    fi

    # 4. Load session state (ALWAYS, ~200 tokens compressed)
    if [ -f "$CONTEXT_DIR/session/state.json" ]; then
        local session=$(jq -c '{
            session_id: .session_id,
            current_task: .current_task,
            next_steps: .next_steps,
            blockers: .blockers
        }' "$CONTEXT_DIR/session/state.json" 2>/dev/null || echo '{}')

        if [ "$session" != "{}" ]; then
            output="$output[CURRENT_SESSION]\n$session"
            local tokens=$(estimate_tokens "$CONTEXT_DIR/session/state.json")
            total_tokens=$((total_tokens + tokens / 2))  # Compressed
            log "Loaded session state (~$((tokens / 2)) tokens)"
        fi
    fi

    # Output the assembled context
    echo -e "$output"

    log "Context load complete. Total estimated tokens: ~$total_tokens"

    # Return token count for budget monitoring
    echo "$total_tokens" > "$PROJECT_ROOT/logs/context-tokens.txt"
}

# Execute
# Output systemMessage for user visibility
echo '{"systemMessage":"Context loaded","continue":true}'
load_context
