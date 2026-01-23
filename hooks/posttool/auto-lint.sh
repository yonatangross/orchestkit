#!/bin/bash
# Auto-Lint Hook - PostToolUse hook for Write/Edit
# Hook: PostToolUse (Write|Edit)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/auto-lint"
