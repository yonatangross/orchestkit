#!/bin/bash
# Migration Safety Check - Agent Hook
# Validates database commands are safe
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/migration-safety-check"
