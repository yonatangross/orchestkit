#!/bin/bash
# Realtime Sync Hook - Graph-First Priority-based immediate memory persistence
# Hook: PostToolUse (Bash, Write, Skill)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/realtime-sync"
