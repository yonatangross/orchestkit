#!/bin/bash
# Security Command Audit - Agent Hook
# Extra audit logging for security agent operations
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/security-command-audit"
