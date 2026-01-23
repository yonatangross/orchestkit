#!/bin/bash
# Feedback Loop - Captures agent completion context and routes findings
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/feedback-loop"
