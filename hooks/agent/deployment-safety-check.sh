#!/bin/bash
# Deployment Safety Check - Agent Hook
# Validates deployment commands for safety
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/deployment-safety-check"
