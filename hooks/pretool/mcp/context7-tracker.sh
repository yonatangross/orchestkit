#!/bin/bash
# Context7 Documentation Tracker - Tracks library lookups
# Hook: PreToolUse (MCP)
# CC 2.1.9: Uses additionalContext for cache state
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/mcp/context7-tracker"
