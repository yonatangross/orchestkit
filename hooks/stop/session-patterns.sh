#!/bin/bash
# Session Patterns - Stop Hook
# Unified pattern learning at session end
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/session-patterns"
