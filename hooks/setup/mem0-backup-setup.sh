#!/bin/bash
# Mem0 Backup Setup Hook - Setup Hook (maintenance)
# Configure scheduled exports
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/mem0-backup-setup"
