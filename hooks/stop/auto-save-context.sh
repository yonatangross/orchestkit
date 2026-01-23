#!/bin/bash
# Auto-Save Context - Saves session context before stop
# Hook: Stop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/auto-save-context"
