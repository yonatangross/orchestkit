#!/bin/bash
# Subagent Quality Gate - Validates subagent output quality
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/subagent-quality-gate"
