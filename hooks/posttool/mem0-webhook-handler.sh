#!/bin/bash
# Mem0 Webhook Handler - Process incoming webhook events
# Hook: PostToolUse (for bash/webhook-receiver.py calls)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/mem0-webhook-handler"
