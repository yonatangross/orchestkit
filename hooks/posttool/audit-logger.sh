#!/bin/bash
# Audit Logger - Logs all tool executions for audit trail
# Hook: PostToolUse (*)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/audit-logger"
