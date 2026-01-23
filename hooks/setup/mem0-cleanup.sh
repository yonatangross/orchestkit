#!/bin/bash
# Mem0 Cleanup Hook - Setup Hook (maintenance)
# Bulk cleanup of old memories
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/mem0-cleanup"
