#!/usr/bin/env bash
# session-patterns.sh - Unified pattern learning at session end
# Part of OrchestKit Plugin - Cross-Project Patterns (#48) + Best Practices (#49)
#
# UNIFIED HOOK: Merges functionality from workflow-pattern-learner.sh
#
# This hook processes patterns at session end:
# 1. Extracts workflow patterns (tool sequences, workflow types, languages)
# 2. Merges queued patterns into learned-patterns.json
# 3. Syncs to mem0 for cross-project learning
# 4. Updates workflow profile for session analytics
#
# CC 2.1.7 Compliant: Uses suppressOutput for silent operation
#
# Merged from workflow-pattern-learner.sh (#135):
# - Tool sequence extraction from session metrics
# - Workflow type detection (TDD, exploration, refactoring, etc.)
# - Dominant language detection
# - Session duration estimation
# - Workflow profile updates with aggregated statistics

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
_HOOK_INPUT=$(cat 2>/dev/null || true)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$SCRIPT_DIR")")}"

# Source libraries
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/mem0.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/mem0.sh"
fi

if [[ -f "${PLUGIN_ROOT}/.claude/scripts/pattern-sync.sh" ]]; then
    source "${PLUGIN_ROOT}/.claude/scripts/pattern-sync.sh"
fi

# Source Memory Fabric for cross-project learning (v2.1)
if [[ -f "${PLUGIN_ROOT}/hooks/_lib/memory-fabric.sh" ]]; then
    source "${PLUGIN_ROOT}/hooks/_lib/memory-fabric.sh"
fi

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/session-patterns.log"
PATTERNS_QUEUE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/patterns-queue.json"
PATTERNS_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/learned-patterns.json"
WORKFLOW_PROFILE="${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/workflow-patterns.json"
METRICS_FILE="/tmp/claude-session-metrics.json"
SESSION_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log"

# Ensure directories exist
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$PATTERNS_FILE")" 2>/dev/null || true
mkdir -p "$(dirname "$WORKFLOW_PROFILE")" 2>/dev/null || true

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [session-patterns] $*" >> "$LOG_FILE" 2>/dev/null || true
}

# -----------------------------------------------------------------------------
# Workflow Pattern Detection (merged from workflow-pattern-learner.sh)
# -----------------------------------------------------------------------------

# Extract tool usage sequence from session metrics
extract_tool_sequence() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo ""
        return
    fi

    # Get tools and their counts
    local tools
    tools=$(jq -r '.tools | to_entries | sort_by(-.value) | .[0:10] | .[].key' "$METRICS_FILE" 2>/dev/null) || true
    echo "$tools" | tr '\n' ','
}

# Analyze recent hook log for file access patterns
extract_file_patterns() {
    if [[ ! -f "$SESSION_LOG" ]]; then
        echo ""
        return
    fi

    # Get recently accessed files from log (last 200 lines)
    local files=""
    files=$(tail -200 "$SESSION_LOG" 2>/dev/null | \
            grep -oE '\.(py|ts|tsx|js|jsx|go|rs|java|md|json|yaml|yml)[[:space:]]' | \
            sort | uniq -c | sort -rn | head -10 | \
            awk '{print $2}' | tr '\n' ',' 2>/dev/null) || true
    echo "$files"
}

# Detect workflow type based on tool usage patterns
detect_workflow_type() {
    local tools="$1"

    # Common workflow patterns
    if echo "$tools" | grep -q "Write" && echo "$tools" | grep -q "Bash"; then
        if echo "$tools" | grep -qE "(test|pytest|jest|vitest)"; then
            echo "test-driven-development"
            return
        fi
    fi

    if echo "$tools" | grep -q "Read" && echo "$tools" | grep -q "Grep"; then
        echo "code-exploration"
        return
    fi

    if echo "$tools" | grep -q "Edit" && ! echo "$tools" | grep -q "Write"; then
        echo "refactoring"
        return
    fi

    if echo "$tools" | grep -q "Write" && echo "$tools" | grep -q "Read"; then
        echo "feature-development"
        return
    fi

    if echo "$tools" | grep -q "Bash" && echo "$tools" | grep -qE "(git|gh)"; then
        echo "git-operations"
        return
    fi

    echo "general"
}

# Detect dominant language from file extensions
detect_dominant_language() {
    local files="$1"

    local py_count=0
    local ts_count=0
    local js_count=0
    local go_count=0

    py_count=$(echo "$files" | grep -o '\.py' | wc -l | tr -d ' ')
    ts_count=$(echo "$files" | grep -oE '\.(ts|tsx)' | wc -l | tr -d ' ')
    js_count=$(echo "$files" | grep -oE '\.(js|jsx)' | wc -l | tr -d ' ')
    go_count=$(echo "$files" | grep -o '\.go' | wc -l | tr -d ' ')

    # Find dominant
    local max_count=$py_count
    local dominant="python"

    if [[ $ts_count -gt $max_count ]]; then
        max_count=$ts_count
        dominant="typescript"
    fi

    if [[ $js_count -gt $max_count ]]; then
        max_count=$js_count
        dominant="javascript"
    fi

    if [[ $go_count -gt $max_count ]]; then
        max_count=$go_count
        dominant="go"
    fi

    if [[ $max_count -eq 0 ]]; then
        dominant="unknown"
    fi

    echo "$dominant"
}

# Get total tool invocations from metrics
get_tool_count() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        echo "0"
        return
    fi

    jq '[.tools | to_entries[].value] | add // 0' "$METRICS_FILE" 2>/dev/null || echo "0"
}

# Extract session duration from metrics or estimate
get_session_duration() {
    # Try to estimate from log timestamps if available
    if [[ -f "$SESSION_LOG" ]]; then
        local first_ts
        local last_ts

        first_ts=$(head -1 "$SESSION_LOG" 2>/dev/null | grep -oE '\[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\]' | tr -d '[]' | head -1)
        last_ts=$(tail -1 "$SESSION_LOG" 2>/dev/null | grep -oE '\[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\]' | tr -d '[]' | head -1)

        if [[ -n "$first_ts" && -n "$last_ts" ]]; then
            # Convert to seconds and calculate difference
            local first_epoch
            local last_epoch

            if command -v gdate >/dev/null 2>&1; then
                # macOS with coreutils
                first_epoch=$(gdate -d "$first_ts" +%s 2>/dev/null) || first_epoch=0
                last_epoch=$(gdate -d "$last_ts" +%s 2>/dev/null) || last_epoch=0
            else
                # Linux
                first_epoch=$(date -d "$first_ts" +%s 2>/dev/null) || first_epoch=0
                last_epoch=$(date -d "$last_ts" +%s 2>/dev/null) || last_epoch=0
            fi

            if [[ $first_epoch -gt 0 && $last_epoch -gt 0 ]]; then
                echo $((last_epoch - first_epoch))
                return
            fi
        fi
    fi

    echo "0"
}

# -----------------------------------------------------------------------------
# Workflow Profile Management
# -----------------------------------------------------------------------------

# Initialize workflow profile if needed
init_workflow_profile() {
    if [[ ! -f "$WORKFLOW_PROFILE" ]]; then
        cat > "$WORKFLOW_PROFILE" << 'EOF'
{
  "version": "1.0.0",
  "last_updated": null,
  "sessions_count": 0,
  "workflow_types": {
    "test-driven-development": 0,
    "code-exploration": 0,
    "refactoring": 0,
    "feature-development": 0,
    "git-operations": 0,
    "general": 0
  },
  "common_tool_sequences": [],
  "dominant_languages": {
    "python": 0,
    "typescript": 0,
    "javascript": 0,
    "go": 0,
    "rust": 0,
    "unknown": 0
  },
  "average_tools_per_session": 0,
  "average_session_duration_seconds": 0,
  "tool_frequency": {}
}
EOF
    fi
}

# Update workflow profile with session data
update_workflow_profile() {
    local workflow_type="$1"
    local dominant_lang="$2"
    local tool_count="$3"
    local session_duration="$4"
    local tool_sequence="$5"

    init_workflow_profile

    local tmp_file
    tmp_file=$(mktemp)

    local timestamp
    timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Update the profile using jq
    jq --arg workflow "$workflow_type" \
       --arg lang "$dominant_lang" \
       --argjson tool_count "${tool_count:-0}" \
       --argjson duration "${session_duration:-0}" \
       --arg sequence "$tool_sequence" \
       --arg ts "$timestamp" '
       .last_updated = $ts |
       .sessions_count += 1 |

       # Update workflow type counts
       .workflow_types[$workflow] //= 0 |
       .workflow_types[$workflow] += 1 |

       # Update dominant language counts
       .dominant_languages[$lang] //= 0 |
       .dominant_languages[$lang] += 1 |

       # Update running averages
       .average_tools_per_session = ((.average_tools_per_session * (.sessions_count - 1) + $tool_count) / .sessions_count) |

       # Update session duration average (only if duration > 0)
       (if $duration > 0 then
         .average_session_duration_seconds = ((.average_session_duration_seconds * (.sessions_count - 1) + $duration) / .sessions_count)
       else . end) |

       # Add tool sequence if meaningful (more than 2 tools)
       (if ($sequence | split(",") | length) > 2 then
         .common_tool_sequences = ([$sequence] + .common_tool_sequences | unique | .[0:20])
       else . end)
    ' "$WORKFLOW_PROFILE" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$WORKFLOW_PROFILE"
}

# Update individual tool frequency in workflow profile
update_tool_frequency() {
    if [[ ! -f "$METRICS_FILE" ]]; then
        return
    fi

    init_workflow_profile

    local tmp_file
    tmp_file=$(mktemp)

    # Get current metrics and merge with profile
    jq --slurpfile metrics "$METRICS_FILE" '
       .tool_frequency = (
         .tool_frequency as $existing |
         ($metrics[0].tools // {}) as $new |
         $existing | to_entries | map({key: .key, value: (.value + ($new[.key] // 0))}) | from_entries |
         . + ($new | to_entries | map(select(.key as $k | $existing[$k] == null)) | from_entries)
       )
    ' "$WORKFLOW_PROFILE" > "$tmp_file" 2>/dev/null && mv "$tmp_file" "$WORKFLOW_PROFILE"
}

# Process workflow patterns (entry point for workflow analysis)
process_workflow_patterns() {
    # Get tool count first to check if session was meaningful
    local tool_count
    tool_count=$(get_tool_count)

    # Skip if session was too short (less than 5 tool invocations)
    if [[ "$tool_count" -lt 5 ]]; then
        log "Session too short for workflow analysis (tools: $tool_count)"
        return 0
    fi

    # Extract patterns
    local tool_sequence
    tool_sequence=$(extract_tool_sequence)

    local file_patterns
    file_patterns=$(extract_file_patterns)

    local workflow_type
    workflow_type=$(detect_workflow_type "$tool_sequence")

    local dominant_lang
    dominant_lang=$(detect_dominant_language "$file_patterns")

    local session_duration
    session_duration=$(get_session_duration)

    # Update workflow profile
    update_workflow_profile "$workflow_type" "$dominant_lang" "$tool_count" "$session_duration" "$tool_sequence"
    update_tool_frequency

    log "Workflow analyzed: type=$workflow_type lang=$dominant_lang tools=$tool_count duration=${session_duration}s"
}

# -----------------------------------------------------------------------------
# Pattern Processing
# -----------------------------------------------------------------------------

# Initialize patterns file if needed
init_patterns_file() {
    if [[ ! -f "$PATTERNS_FILE" ]]; then
        cat > "$PATTERNS_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "patterns": [],
  "categories": {},
  "stats": {
    "total": 0,
    "successes": 0,
    "failures": 0
  }
}
EOF
    fi
}

# Merge queued patterns into learned patterns file
merge_patterns() {
    if [[ ! -f "$PATTERNS_QUEUE" ]]; then
        log "No patterns queue found"
        return 0
    fi

    local queue_count
    queue_count=$(jq '.patterns | length' "$PATTERNS_QUEUE" 2>/dev/null) || queue_count=0

    if [[ "$queue_count" == "0" ]]; then
        log "Patterns queue is empty"
        return 0
    fi

    log "Processing $queue_count queued patterns..."

    init_patterns_file

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    # Merge patterns and update stats
    jq -s --arg now "$now" '
        .[0] as $existing |
        .[1] as $queue |
        ($queue.patterns // []) as $new_patterns |

        # Deduplicate by text (keep most recent)
        (($existing.patterns // []) + $new_patterns) |
        group_by(.text) |
        map(sort_by(.timestamp) | last) as $all_patterns |

        # Calculate stats
        ($all_patterns | map(select(.outcome == "success")) | length) as $successes |
        ($all_patterns | map(select(.outcome == "failed")) | length) as $failures |

        # Group by category
        ($all_patterns | group_by(.category) | map({(.[0].category): length}) | add // {}) as $categories |

        $existing |
        .updated = $now |
        .patterns = $all_patterns |
        .categories = $categories |
        .stats.total = ($all_patterns | length) |
        .stats.successes = $successes |
        .stats.failures = $failures
    ' "$PATTERNS_FILE" "$PATTERNS_QUEUE" > "$tmp_file" 2>/dev/null

    if jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PATTERNS_FILE"
        log "Merged patterns successfully"

        # Clear the queue
        echo '{"patterns": []}' > "$PATTERNS_QUEUE"
    else
        rm -f "$tmp_file"
        log "Error merging patterns"
        return 1
    fi
}

# Generate mem0 storage instructions for Claude
generate_mem0_instructions() {
    if [[ ! -f "$PATTERNS_FILE" ]]; then
        return 0
    fi

    local new_patterns
    new_patterns=$(jq -r '
        .patterns // [] |
        sort_by(.timestamp) |
        reverse |
        .[0:5] |
        .[] |
        "\(.outcome): \(.text) (category: \(.category))"
    ' "$PATTERNS_FILE" 2>/dev/null) || return 0

    if [[ -n "$new_patterns" ]]; then
        log "Recent patterns for mem0 storage:"
        log "$new_patterns"

        # Output instruction for Claude to store in mem0
        cat << EOF

## Session Patterns Summary

The following patterns were observed this session:

$new_patterns

These will be automatically available for cross-project pattern matching.
EOF
    fi
}

# Sync patterns to global storage
sync_to_global() {
    if type push_project_patterns &>/dev/null; then
        log "Syncing patterns to global storage..."
        push_project_patterns >> "$LOG_FILE" 2>&1 || log "Global sync failed"
    else
        log "Global sync not available (pattern-sync.sh not loaded)"
    fi
}

# Extract session summary patterns
extract_session_summary() {
    local session_id="${CLAUDE_SESSION_ID:-unknown}"
    local project_id
    project_id=$(mem0_get_project_id 2>/dev/null) || project_id="unknown"

    # Check if there were any significant activities this session
    local patterns_count
    patterns_count=$(jq '.patterns | length' "$PATTERNS_FILE" 2>/dev/null) || patterns_count=0

    if [[ "$patterns_count" -gt 0 ]]; then
        log "Session $session_id completed with $patterns_count patterns recorded"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    log "Session ending, processing patterns..."

    # 1. Process workflow patterns (tool sequences, workflow types, languages)
    #    Merged from workflow-pattern-learner.sh - updates workflow-patterns.json
    process_workflow_patterns

    # 2. Merge queued patterns into learned patterns file
    merge_patterns

    # 3. Sync to global storage
    sync_to_global

    # 4. Extract session summary
    extract_session_summary

    log "Pattern processing complete"

    # Silent success
    echo '{"continue": true, "suppressOutput": true}'
}

main "$@"
