#!/bin/bash
# Context Budget Monitor - After Tool Use Hook
# Hook: PostToolUse (*)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/context-budget-monitor"
