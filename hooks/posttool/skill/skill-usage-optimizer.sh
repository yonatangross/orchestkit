#!/usr/bin/env bash
# skill-usage-optimizer.sh - Track skill usage and suggest consolidation
# Hook: PostToolUse (Skill)
# Issue: #127 (CRITICAL)
#
# Tracks which skills are used and how often.
# Stores metrics in .claude/feedback/skill-usage.json
# Suggests skill consolidation if overlap detected.
#
# CC 2.1.9 Compliant: Uses additionalContext for suggestions
# Version: 1.0.0

set -euo pipefail

# Read stdin BEFORE sourcing common.sh
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../../_lib/common.sh"

# Get skill name from tool input
SKILL_NAME=$(get_field '.tool_input.skill // .tool_name // ""')
[[ -z "$SKILL_NAME" ]] && { output_silent_success; exit 0; }

# Filter: Only process Skill tool uses
TOOL_NAME=$(get_field '.tool_name // ""')
if [[ "$TOOL_NAME" != "Skill" && ! "$SKILL_NAME" =~ ^skills/ ]]; then
    # This might be a different tool type, check if it's a skill invocation
    if [[ -z "$SKILL_NAME" || "$SKILL_NAME" == "null" ]]; then
        output_silent_success
        exit 0
    fi
fi

# Configuration
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"
USAGE_FILE="${PROJECT_ROOT}/.claude/feedback/skill-usage.json"
LOG_FILE="${PROJECT_ROOT}/.claude/logs/skill-usage-optimizer.log"
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

# Skill overlap definitions for consolidation suggestions
# Format: "skill1|skill2" -> "consolidated-skill or suggestion"
declare -A SKILL_OVERLAPS=(
    ["api-design-framework|fastapi-advanced"]="Both relate to API design. Consider using api-design-framework for patterns, fastapi-advanced for implementation."
    ["sqlalchemy-2-async|database-schema-designer"]="Both relate to database. Use database-schema-designer for schema design, sqlalchemy-2-async for async patterns."
    ["caching-strategies|performance-optimization"]="Both optimize performance. Consider consolidating caching queries."
    ["auth-patterns|owasp-top-10"]="Both relate to security. auth-patterns for implementation, owasp-top-10 for validation."
    ["asyncio-advanced|connection-pooling"]="Both relate to async. asyncio-advanced for patterns, connection-pooling for specific optimization."
)

# Ensure directories exist
mkdir -p "$(dirname "$USAGE_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [skill-usage-optimizer] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# Initialize usage file if it doesn't exist
init_usage_file() {
    if [[ ! -f "$USAGE_FILE" ]]; then
        cat > "$USAGE_FILE" << 'EOF'
{
  "version": "1.0",
  "skills": {},
  "sessions": {},
  "last_updated": ""
}
EOF
    fi
}

# Update skill usage count (uses atomic_json_update for multi-instance safety)
update_usage() {
    local skill="$1"
    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    init_usage_file

    # Build jq filter for atomic update
    local jq_filter='
        # Update skill count
        .skills[$skill] = ((.skills[$skill] // 0) + 1) |

        # Track session usage
        .sessions[$session] = ((.sessions[$session] // []) + [$skill]) |
        .sessions[$session] = (.sessions[$session] | unique) |

        # Update timestamp
        .last_updated = $timestamp
    '

    # Use atomic_json_update for multi-instance safe write
    atomic_json_update "$USAGE_FILE" "$jq_filter" \
       --arg skill "$skill" \
       --arg session "$SESSION_ID" \
       --arg timestamp "$timestamp"

    log "Updated usage for skill: $skill (session: $SESSION_ID)"
}

# Get session skills for overlap detection
get_session_skills() {
    if [[ ! -f "$USAGE_FILE" ]]; then
        echo "[]"
        return
    fi

    jq -r --arg session "$SESSION_ID" '.sessions[$session] // []' "$USAGE_FILE" 2>/dev/null || echo "[]"
}

# Check for skill overlaps and suggest consolidation
check_overlaps() {
    local current_skill="$1"
    local session_skills
    session_skills=$(get_session_skills)

    local suggestions=()

    # Check each overlap definition
    for overlap_key in "${!SKILL_OVERLAPS[@]}"; do
        local skill1="${overlap_key%%|*}"
        local skill2="${overlap_key##*|}"
        local suggestion="${SKILL_OVERLAPS[$overlap_key]}"

        # Check if current skill and any session skill form an overlap
        if [[ "$current_skill" == "$skill1" || "$current_skill" == "$skill2" ]]; then
            # Check if the other skill was used in this session
            local other_skill=""
            if [[ "$current_skill" == "$skill1" ]]; then
                other_skill="$skill2"
            else
                other_skill="$skill1"
            fi

            if echo "$session_skills" | jq -e --arg s "$other_skill" 'index($s) != null' >/dev/null 2>&1; then
                suggestions+=("$suggestion")
                log "Overlap detected: $skill1 + $skill2"
            fi
        fi
    done

    # Return first suggestion if any
    if [[ ${#suggestions[@]} -gt 0 ]]; then
        echo "${suggestions[0]}"
    fi
}

# Get top used skills for context
get_usage_stats() {
    if [[ ! -f "$USAGE_FILE" ]]; then
        echo ""
        return
    fi

    # Get top 3 skills with counts
    jq -r '.skills | to_entries | sort_by(-.value) | .[0:3] | map("\(.key):\(.value)") | join(", ")' "$USAGE_FILE" 2>/dev/null || echo ""
}

# Main logic
update_usage "$SKILL_NAME"

# Check for overlaps
OVERLAP_SUGGESTION=$(check_overlaps "$SKILL_NAME")

# Get usage stats
USAGE_STATS=$(get_usage_stats)

# Build context message if we have suggestions or stats
CONTEXT_MSG=""

if [[ -n "$OVERLAP_SUGGESTION" ]]; then
    CONTEXT_MSG="Skill overlap: $OVERLAP_SUGGESTION"
    log "Suggesting consolidation for: $SKILL_NAME"
fi

# Add stats info periodically (every 5th use of any skill)
CURRENT_SKILL_COUNT=$(jq -r --arg s "$SKILL_NAME" '.skills[$s] // 0' "$USAGE_FILE" 2>/dev/null || echo "0")
if [[ "$CURRENT_SKILL_COUNT" -gt 0 && $((CURRENT_SKILL_COUNT % 5)) -eq 0 && -n "$USAGE_STATS" ]]; then
    if [[ -n "$CONTEXT_MSG" ]]; then
        CONTEXT_MSG="$CONTEXT_MSG | Top skills: $USAGE_STATS"
    else
        CONTEXT_MSG="Top skills this project: $USAGE_STATS"
    fi
fi

# Output with context if we have something to say
if [[ -n "$CONTEXT_MSG" ]]; then
    # Truncate if too long
    if [[ ${#CONTEXT_MSG} -gt 200 ]]; then
        CONTEXT_MSG="${CONTEXT_MSG:0:197}..."
    fi
    output_with_context "$CONTEXT_MSG"
else
    output_silent_success
fi

exit 0
