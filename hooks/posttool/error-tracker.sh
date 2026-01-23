#!/bin/bash
# Error Tracker - Tracks and logs tool errors
# Hook: PostToolUse (Bash)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/error-tracker"
