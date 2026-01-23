#!/bin/bash
# Task Completion Check - Stop Hook
# Verifies tasks are properly completed before stop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/task-completion-check"
