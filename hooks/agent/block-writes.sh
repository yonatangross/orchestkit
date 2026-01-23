#!/bin/bash
# Block Writes - Agent Hook
# Blocks Write/Edit operations for read-only agents
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "agent/block-writes"
