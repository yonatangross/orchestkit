#!/bin/bash
# Subagent Completion Tracker - Logs completion events for session correlation
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/subagent-completion-tracker"
