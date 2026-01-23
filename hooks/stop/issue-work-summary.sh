#!/bin/bash
# Issue Work Summary - Stop Hook
# Posts consolidated progress comments to GitHub issues
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "stop/issue-work-summary"
