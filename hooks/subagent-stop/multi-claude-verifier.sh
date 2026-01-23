#!/bin/bash
# Multi-Claude Verifier - Automates multi-Claude verification workflows
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/multi-claude-verifier"
