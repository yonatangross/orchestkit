#!/bin/bash
# Handoff Preparer - Prepares context for handoff to next agent in pipeline
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/handoff-preparer"
