#!/bin/bash
# Sequential Thinking Auto-Tracker - Tracks reasoning chain progress
# Hook: PreToolUse (MCP)
# CC 2.1.7: Logs sequential thinking steps
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/mcp/sequential-thinking-auto"
