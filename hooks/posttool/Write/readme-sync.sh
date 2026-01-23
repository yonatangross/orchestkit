#!/bin/bash
# README Sync Hook - Suggests README updates after significant code changes
# Hook: PostToolUse/Write
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write/readme-sync"
