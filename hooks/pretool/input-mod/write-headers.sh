#!/bin/bash
# Write Headers - Adds standard headers to new files
# Hook: PreToolUse (Write)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/input-mod/write-headers"
