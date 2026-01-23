#!/bin/bash
# Session Metrics - Tracks tool usage statistics
# Hook: PostToolUse (*)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/session-metrics"