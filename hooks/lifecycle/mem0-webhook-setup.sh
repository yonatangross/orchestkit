#!/bin/bash
# Mem0 Webhook Setup - Auto-configure webhooks on first mem0 usage
# Hook: SessionStart
# CC 2.1.7 Compliant
#
# Features:
# - Checks if webhooks exist for mem0 automation
# - Creates webhooks if missing
# - Configures webhook URL endpoint
# - Sets up event types: memory.created, memory.updated, memory.deleted
#
# Version: 1.0.0

set -euo pipefail

# Read and discard stdin
if [[ -t 0 ]]; then
    _HOOK_INPUT=""
else
    _HOOK_INPUT=$(cat 2>/dev/null || true)
fi
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh" 2>/dev/null || true
source "$SCRIPT_DIR/../_lib/mem0.sh" 2>/dev/null || true

# Start timing
start_hook_timing

# Bypass if slow hooks are disabled
if should_skip_slow_hooks; then
    log_hook "Skipping mem0 webhook setup (ORCHESTKIT_SKIP_SLOW_HOOKS=1)"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

log_hook "Mem0 webhook setup starting"

# Check if mem0 is available
if ! is_mem0_available 2>/dev/null; then
    log_hook "Mem0 not available, skipping webhook setup"
    echo '{"continue":true,"suppressOutput":true}'
    exit 0
fi

# Configuration
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
WEBHOOK_CONFIG_FILE="$PROJECT_DIR/.claude/mem0-webhooks.json"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$SCRIPT_DIR/../..}"
WEBHOOK_SCRIPT="$PLUGIN_ROOT/skills/mem0-memory/scripts"

# Webhook configuration
WEBHOOK_NAME="orchestkit-auto-sync"
WEBHOOK_EVENTS='["memory.created","memory.updated","memory.deleted"]'

# Determine webhook URL (placeholder - should be configured)
# In production, this would be a real endpoint
WEBHOOK_URL="${MEM0_WEBHOOK_URL:-https://example.com/webhook/mem0}"

# Check if webhooks already exist
log_hook "Checking for existing webhooks"

# List existing webhooks with timeout
if [[ -f "$WEBHOOK_SCRIPT/list-webhooks.py" ]]; then
    WEBHOOKS_OUTPUT=$(run_with_timeout 1 python3 "$WEBHOOK_SCRIPT/list-webhooks.py" 2>/dev/null || echo '{"webhooks":[]}')
    EXISTING_WEBHOOKS=$(echo "$WEBHOOKS_OUTPUT" | jq -r '.webhooks // [] | length' 2>/dev/null || echo "0")
    
    if [[ "$EXISTING_WEBHOOKS" -gt 0 ]]; then
        log_hook "Found $EXISTING_WEBHOOKS existing webhook(s), skipping setup"
        echo '{"continue":true,"suppressOutput":true}'
        exit 0
    fi
fi

# Create webhook if it doesn't exist (with timeout)
log_hook "No webhooks found, creating webhook: $WEBHOOK_NAME"

# Note: Webhook creation requires a valid URL endpoint
# This is a setup hook that checks/creates - actual webhook URL should be configured separately
if [[ -f "$WEBHOOK_SCRIPT/create-webhook.py" && -n "${MEM0_WEBHOOK_URL:-}" ]]; then
    run_with_timeout 1 python3 "$WEBHOOK_SCRIPT/create-webhook.py" \
        --url "$WEBHOOK_URL" \
        --name "$WEBHOOK_NAME" \
        --event-types "$WEBHOOK_EVENTS" \
        2>/dev/null || log_hook "Warning: Could not create webhook (URL may need configuration or timed out)"
else
    log_hook "Webhook URL not configured (set MEM0_WEBHOOK_URL), skipping creation"
fi

# Save webhook config
mkdir -p "$(dirname "$WEBHOOK_CONFIG_FILE")" 2>/dev/null || true
echo "{\"webhook_name\":\"$WEBHOOK_NAME\",\"events\":$WEBHOOK_EVENTS,\"url\":\"$WEBHOOK_URL\"}" > "$WEBHOOK_CONFIG_FILE" 2>/dev/null || true

log_hook "Webhook setup complete"

# Log timing
log_hook_timing "mem0-webhook-setup"

echo '{"continue":true,"suppressOutput":true}'
exit 0
