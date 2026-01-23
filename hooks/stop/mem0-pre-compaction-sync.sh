#!/bin/bash
# Mem0 Pre-Compaction Sync Hook - Stop Hook
# Saves important session context to Mem0 before compaction
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/mem0-pre-compaction-sync"
