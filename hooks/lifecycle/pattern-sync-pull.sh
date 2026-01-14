#!/bin/bash
# Pattern Sync Pull - SessionStart Hook
# CC 2.1.6 Compliant: silent on success
# Pulls global patterns into project on session start
#
# Part of Cross-Project Patterns (#48)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source pattern sync library
PATTERN_SYNC_LIB="${CLAUDE_PROJECT_DIR:-.}/.claude/scripts/pattern-sync.sh"
if [[ -f "$PATTERN_SYNC_LIB" ]]; then
    source "$PATTERN_SYNC_LIB"
else
    # Fallback to plugin root
    PLUGIN_SYNC_LIB="${CLAUDE_PLUGIN_ROOT:-}/.claude/scripts/pattern-sync.sh"
    if [[ -f "$PLUGIN_SYNC_LIB" ]]; then
        source "$PLUGIN_SYNC_LIB"
    else
        # Library not available - silent pass
        echo '{"continue": true}'
        exit 0
    fi
fi

# Log to hooks log
LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log"
log_hook() {
    local msg="$1"
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] [pattern-sync-pull] $msg" >> "$LOG_FILE" 2>/dev/null || true
}

# Check if sync is enabled
if ! is_sync_enabled; then
    log_hook "Global sync disabled, skipping pull"
    echo '{"continue": true}'
    exit 0
fi

# Pull global patterns
log_hook "Pulling global patterns..."
if pull_global_patterns > /dev/null 2>&1; then
    log_hook "Global patterns pulled successfully"
else
    log_hook "Failed to pull global patterns"
fi

# Silent success
echo '{"continue": true}'
exit 0