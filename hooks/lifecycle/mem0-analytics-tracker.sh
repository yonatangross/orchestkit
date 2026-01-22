#!/bin/bash
# Mem0 Analytics Tracker - Monitor usage patterns continuously
# Hook: SessionStart / UserPromptSubmit
# CC 2.1.7 Compliant
#
# Features:
# - Tracks mem0 usage patterns
# - Monitors feature utilization
# - Identifies underutilized features
#
# Version: 1.0.0

set -euo pipefail

if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || true

log_hook "Mem0 analytics tracker starting"

# Check if mem0 is available
if ! is_mem0_available 2>/dev/null; then
    log_hook "Mem0 not available, skipping analytics"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Configuration
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
ANALYTICS_FILE="$PROJECT_DIR/.claude/logs/mem0-analytics.jsonl"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$SCRIPT_DIR/../..}"
SUMMARY_SCRIPT="$PLUGIN_ROOT/skills/mem0-memory/scripts/memory-summary.py"

# Track usage event
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create analytics entry
ANALYTICS_ENTRY=$(jq -n \
    --arg session_id "$SESSION_ID" \
    --arg timestamp "$TIMESTAMP" \
    '{
        session_id: $session_id,
        timestamp: $timestamp,
        event: "session_start"
    }')

# Append to analytics log
mkdir -p "$(dirname "$ANALYTICS_FILE")" 2>/dev/null || true
echo "$ANALYTICS_ENTRY" >> "$ANALYTICS_FILE" 2>/dev/null || true

log_hook "Mem0 analytics tracked"

echo '{"continue":true,"suppressOutput":true}'
exit 0
