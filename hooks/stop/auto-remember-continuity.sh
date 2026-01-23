#!/bin/bash
# Auto-Remember Continuity - Stop Hook
# Prompts Claude to store session context before end
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/auto-remember-continuity"
