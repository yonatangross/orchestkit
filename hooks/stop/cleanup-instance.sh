#!/bin/bash
# Cleanup Instance - Stop Hook
# Releases all locks and unregisters instance when Claude Code exits
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/cleanup-instance"
