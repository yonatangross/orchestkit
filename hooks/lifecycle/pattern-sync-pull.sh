#!/bin/bash
# Pattern Sync Pull - SessionStart Hook
# CC 2.1.7 Compliant: silent on success with suppressOutput
# Pulls global patterns into project on session start
#
# Part of Cross-Project Patterns (#48)
# Optimized with timeout and file size checks to prevent startup hangs

set -euo pipefail

# Read and discard stdin to prevent broken pipe errors in hook chain
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source common utilities for timeout and bypass
source "$SCRIPT_DIR/../_lib/common.sh"

# Start timing
start_hook_timing

# Bypass if slow hooks are disabled
if should_skip_slow_hooks; then
    log_hook "Skipping pattern sync (ORCHESTKIT_SKIP_SLOW_HOOKS=1)"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

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
        # Library not available - silent pass (CC 2.1.7)
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    fi
fi

# Check if sync is enabled
if ! is_sync_enabled; then
    log_hook "Global sync disabled, skipping pull"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Check file sizes before processing (skip if files are too large)
GLOBAL_PATTERNS_FILE="${GLOBAL_PATTERNS_FILE:-${HOME}/.claude/global-patterns.json}"
PROJECT_PATTERNS_FILE="${PROJECT_PATTERNS_FILE:-${CLAUDE_PROJECT_DIR:-.}/.claude/feedback/learned-patterns.json}"
MAX_FILE_SIZE_MB=1
MAX_FILE_SIZE_BYTES=$((MAX_FILE_SIZE_MB * 1024 * 1024))

check_file_size() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        return 0  # File doesn't exist, that's fine
    fi
    
    local size
    if [[ "$(uname)" == "Darwin" ]]; then
        size=$(stat -f%z "$file" 2>/dev/null || echo 0)
    else
        size=$(stat -c%s "$file" 2>/dev/null || echo 0)
    fi
    
    if [[ $size -gt $MAX_FILE_SIZE_BYTES ]]; then
        log_hook "WARN: Skipping pattern sync - file too large: $file (${size} bytes > ${MAX_FILE_SIZE_BYTES} bytes)"
        return 1
    fi
    return 0
}

# Check file sizes
if ! check_file_size "$GLOBAL_PATTERNS_FILE" || ! check_file_size "$PROJECT_PATTERNS_FILE"; then
    log_hook "Skipping pattern sync due to large files"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Pull global patterns with timeout (2 seconds max for SessionStart hooks)
log_hook "Pulling global patterns..."
if run_with_timeout 2 bash -c 'pull_global_patterns > /dev/null 2>&1'; then
    log_hook "Global patterns pulled successfully"
else
    log_hook "Failed to pull global patterns (or timed out)"
fi

# Log timing
log_hook_timing "pattern-sync-pull"

# Silent success (CC 2.1.7)
echo '{"continue":true,"suppressOutput":true}'
exit 0