#!/bin/bash
# Coordination Heartbeat - Update heartbeat after each tool use
# Hook: PostToolUse (*)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/coordination-heartbeat"
