#!/bin/bash
# Auto-Spawn Quality - Auto-spawns quality agents after completions
# Hook: SubagentStop
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "subagent-stop/auto-spawn-quality"
