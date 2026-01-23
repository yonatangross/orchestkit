#!/bin/bash
# Error Collector - Captures all tool errors for pattern analysis
# Hook: PostToolUse (*)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/error-collector"
