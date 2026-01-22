#!/usr/bin/env bash
# pattern-sync.sh - Cross-project pattern synchronization
# Part of OrchestKit Claude Plugin (#48)
#
# Syncs learned patterns between project-level and global user-level storage
# to share knowledge across repositories.

set -euo pipefail

# =============================================================================
# CONSTANTS
# =============================================================================

# Global patterns location (user-level, shared across all projects)
GLOBAL_PATTERNS_DIR="${GLOBAL_PATTERNS_DIR:-${HOME}/.claude}"
GLOBAL_PATTERNS_FILE="${GLOBAL_PATTERNS_FILE:-${GLOBAL_PATTERNS_DIR}/global-patterns.json}"

# Project patterns location
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-.}"
PROJECT_PATTERNS_FILE="${PROJECT_PATTERNS_FILE:-${PROJECT_DIR}/.claude/feedback/learned-patterns.json}"
PROJECT_PREFERENCES_FILE="${PROJECT_PREFERENCES_FILE:-${PROJECT_DIR}/.claude/feedback/preferences.json}"

# Sync thresholds
MIN_CONFIDENCE_FOR_SYNC="${MIN_CONFIDENCE_FOR_SYNC:-0.95}"  # Only sync high-confidence patterns
MIN_SAMPLES_FOR_SYNC="${MIN_SAMPLES_FOR_SYNC:-5}"           # Minimum samples before syncing

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize global patterns directory and file
init_global_patterns() {
    mkdir -p "$GLOBAL_PATTERNS_DIR"

    if [[ ! -f "$GLOBAL_PATTERNS_FILE" ]]; then
        cat > "$GLOBAL_PATTERNS_FILE" << 'EOF'
{
  "version": "1.0",
  "updated": "",
  "permissions": {},
  "codeStyle": {},
  "metadata": {
    "projectCount": 0,
    "lastSync": "",
    "syncHistory": []
  }
}
EOF
    fi

    # Ensure .gitkeep for global dir
    touch "${GLOBAL_PATTERNS_DIR}/.gitkeep" 2>/dev/null || true
}

# Check if global sync is enabled in preferences
is_sync_enabled() {
    if [[ ! -f "$PROJECT_PREFERENCES_FILE" ]]; then
        return 0  # Default to enabled
    fi

    local sync_enabled
    # Note: Can't use // operator as it treats false as falsy
    sync_enabled=$(jq -r 'if has("syncGlobalPatterns") then .syncGlobalPatterns else true end' "$PROJECT_PREFERENCES_FILE" 2>/dev/null || echo "true")

    [[ "$sync_enabled" == "true" ]]
}

# =============================================================================
# PATTERN FILTERING
# =============================================================================

# Check if a pattern should be excluded from global sync
should_exclude_pattern() {
    local pattern="$1"

    # Define patterns to exclude inline for portability
    local exclude_patterns=(
        '^/'
        'node_modules'
        '.git/'
        '__pycache__'
        '/dist/'
        '/build/'
        '/target/'
    )

    for exclude in "${exclude_patterns[@]}"; do
        if echo "$pattern" | grep -qE "$exclude"; then
            return 0  # Should exclude
        fi
    done

    return 1  # Should include
}

# Normalize a command pattern for cross-project use
normalize_pattern() {
    local pattern="$1"

    # Remove absolute paths, replace with relative markers
    pattern=$(echo "$pattern" | sed 's|/[^ ]*/\([^/]*\)|\1|g')

    # Normalize common variations
    pattern=$(echo "$pattern" | sed 's|\\|/|g')  # Backslash to forward slash

    echo "$pattern"
}

# =============================================================================
# SYNC OPERATIONS
# =============================================================================

# Pull global patterns into project
# Merges global patterns with project patterns, respecting confidence scores
pull_global_patterns() {
    if ! is_sync_enabled; then
        echo "Global sync disabled in preferences"
        return 0
    fi

    init_global_patterns

    if [[ ! -f "$GLOBAL_PATTERNS_FILE" ]]; then
        echo "No global patterns file found"
        return 0
    fi

    if [[ ! -f "$PROJECT_PATTERNS_FILE" ]]; then
        echo "No project patterns file found"
        return 0
    fi

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local tmp_file
    tmp_file=$(mktemp)

    # Create jq filter file to avoid shell quoting issues
    local jq_filter
    jq_filter=$(mktemp)
    cat > "$jq_filter" << 'JQFILTER'
.[0] as $project |
.[1] as $global |
($global.permissions // {}) as $global_perms |
($project.permissions // {}) as $project_perms |
(
  reduce ($global_perms | to_entries[]) as $entry (
    $project_perms;
    if .[$entry.key] == null then
      .[$entry.key] = $entry.value
    elif .[$entry.key].confidence < $entry.value.confidence then
      .[$entry.key].confidence = $entry.value.confidence |
      .[$entry.key].autoApprove = $entry.value.autoApprove
    else
      .
    end
  )
) as $merged_perms |
($project.codeStyle // {}) as $project_style |
($global.codeStyle // {}) as $global_style |
($project_style + $global_style) as $merged_style |
$project |
.permissions = $merged_perms |
.codeStyle = $merged_style |
.updated = $ARGS.named.now |
if .metadata then .metadata.lastGlobalPull = $ARGS.named.now else . + {metadata: {lastGlobalPull: $ARGS.named.now}} end
JQFILTER

    jq -s --arg now "$now" -f "$jq_filter" "$PROJECT_PATTERNS_FILE" "$GLOBAL_PATTERNS_FILE" > "$tmp_file" 2>/dev/null
    local jq_exit=$?
    rm -f "$jq_filter"

    if [[ $jq_exit -eq 0 ]] && jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PROJECT_PATTERNS_FILE"
        echo "Pulled global patterns successfully"
        return 0
    else
        rm -f "$tmp_file"
        echo "Error merging patterns"
        return 1
    fi
}

# Push project patterns to global
# Only pushes high-confidence, non-project-specific patterns
push_project_patterns() {
    if ! is_sync_enabled; then
        echo "Global sync disabled in preferences"
        return 0
    fi

    init_global_patterns

    if [[ ! -f "$PROJECT_PATTERNS_FILE" ]]; then
        echo "No project patterns to push"
        return 0
    fi

    local now
    now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local project_name
    project_name=$(basename "$PROJECT_DIR")

    local tmp_file
    tmp_file=$(mktemp)

    # Create jq filter file to avoid shell quoting issues
    local jq_filter
    jq_filter=$(mktemp)
    cat > "$jq_filter" << 'JQFILTER'
.[0] as $project |
.[1] as $global |
[
  $project.permissions // {} | to_entries[] |
  select(.value.confidence >= ($ARGS.named.min_conf | tonumber)) |
  select(.value.samples >= ($ARGS.named.min_samples | tonumber))
] as $eligible |
($global.permissions // {}) as $global_perms |
(
  reduce $eligible[] as $entry (
    $global_perms;
    if .[$entry.key] == null then
      .[$entry.key] = $entry.value |
      .[$entry.key].source = $ARGS.named.project
    elif .[$entry.key].confidence < $entry.value.confidence then
      .[$entry.key].confidence = $entry.value.confidence |
      .[$entry.key].autoApprove = $entry.value.autoApprove |
      .[$entry.key].source = $ARGS.named.project
    else
      .
    end
  )
) as $merged_perms |
($global.codeStyle // {}) as $global_style |
($project.codeStyle // {}) as $project_style |
(
  reduce ($project_style | to_entries[]) as $entry (
    $global_style;
    if .[$entry.key] == null then
      .[$entry.key] = $entry.value
    else
      .
    end
  )
) as $merged_style |
$global |
.permissions = $merged_perms |
.codeStyle = $merged_style |
.updated = $ARGS.named.now |
.metadata.lastSync = $ARGS.named.now |
.metadata.projectCount = (
  [.metadata.syncHistory // [] | .[].project, $ARGS.named.project] | unique | length
) |
.metadata.syncHistory = (
  (.metadata.syncHistory // []) + [{
    "project": $ARGS.named.project,
    "timestamp": $ARGS.named.now,
    "patternsAdded": ($eligible | length)
  }] | .[-10:]
)
JQFILTER

    jq -s --arg now "$now" --arg project "$project_name" --arg min_conf "$MIN_CONFIDENCE_FOR_SYNC" --arg min_samples "$MIN_SAMPLES_FOR_SYNC" -f "$jq_filter" "$PROJECT_PATTERNS_FILE" "$GLOBAL_PATTERNS_FILE" > "$tmp_file" 2>/dev/null
    local jq_exit=$?
    rm -f "$jq_filter"

    if [[ $jq_exit -eq 0 ]] && jq empty "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$GLOBAL_PATTERNS_FILE"
        echo "Pushed patterns to global successfully"
        return 0
    else
        rm -f "$tmp_file"
        echo "Error pushing patterns"
        return 1
    fi
}

# Full bidirectional sync
sync_patterns() {
    echo "Starting pattern sync..."

    # Pull first (get global patterns)
    pull_global_patterns

    # Then push (share local patterns)
    push_project_patterns

    echo "Pattern sync complete"
}

# =============================================================================
# REPORTING
# =============================================================================

# Get sync status summary
get_sync_status() {
    init_global_patterns

    local global_count=0
    local project_count=0
    local last_sync="Never"
    local project_count_total=0

    if [[ -f "$GLOBAL_PATTERNS_FILE" ]]; then
        global_count=$(jq '[.permissions // {} | to_entries[] | select(.value.autoApprove == true)] | length' "$GLOBAL_PATTERNS_FILE" 2>/dev/null || echo "0")
        last_sync=$(jq -r '.metadata.lastSync // "Never"' "$GLOBAL_PATTERNS_FILE" 2>/dev/null || echo "Never")
        project_count_total=$(jq -r '.metadata.projectCount // 0' "$GLOBAL_PATTERNS_FILE" 2>/dev/null || echo "0")
    fi

    if [[ -f "$PROJECT_PATTERNS_FILE" ]]; then
        project_count=$(jq '[.permissions // {} | to_entries[] | select(.value.autoApprove == true)] | length' "$PROJECT_PATTERNS_FILE" 2>/dev/null || echo "0")
    fi

    local sync_enabled="Enabled"
    if ! is_sync_enabled; then
        sync_enabled="Disabled"
    fi

    cat << EOF
Pattern Sync Status
────────────────────────────
Global sync: ${sync_enabled}
Last sync: ${last_sync}

Global patterns: ${global_count} auto-approve rules
Project patterns: ${project_count} auto-approve rules
Projects synced: ${project_count_total}

Global file: ${GLOBAL_PATTERNS_FILE}
EOF
}

# List all global patterns
list_global_patterns() {
    init_global_patterns

    if [[ ! -f "$GLOBAL_PATTERNS_FILE" ]]; then
        echo "No global patterns file"
        return 0
    fi

    echo "Global Auto-Approve Patterns"
    echo "────────────────────────────"

    jq -r '
        .permissions // {} | to_entries[] |
        select(.value.autoApprove == true) |
        "  \(.key) (confidence: \(.value.confidence | . * 100 | floor)%)"
    ' "$GLOBAL_PATTERNS_FILE" 2>/dev/null || echo "  (none)"

    echo ""
    echo "Code Style Preferences"
    echo "────────────────────────────"

    jq -r '
        .codeStyle // {} | to_entries[] |
        "  \(.key): \(.value)"
    ' "$GLOBAL_PATTERNS_FILE" 2>/dev/null || echo "  (none)"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f init_global_patterns
export -f is_sync_enabled
export -f should_exclude_pattern
export -f normalize_pattern
export -f pull_global_patterns
export -f push_project_patterns
export -f sync_patterns
export -f get_sync_status
export -f list_global_patterns