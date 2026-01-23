#!/bin/bash
# Error Solution Suggester - PostToolUse hook for error remediation
# Hook: PostToolUse (Bash)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/error-solution-suggester"
