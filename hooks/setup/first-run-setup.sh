#!/bin/bash
# First Run Setup - Setup Hook
# Full setup with optional interactive wizard
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/first-run-setup"
