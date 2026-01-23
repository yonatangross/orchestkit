#!/bin/bash
# Mem0 Analytics Dashboard - Setup Hook (maintenance)
# Generate weekly/monthly usage reports
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "setup/mem0-analytics-dashboard"
