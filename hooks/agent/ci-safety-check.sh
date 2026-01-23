#!/bin/bash
# CI Safety Check - Agent Hook
# Validates CI/CD commands for safety
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/ci-safety-check"
