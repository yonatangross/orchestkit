#!/bin/bash
# Architecture Change Detector - Detects breaking architectural changes
# Hook: PreToolUse (Write)
# CC 2.1.9: Uses additionalContext for proactive guidance
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/Write/architecture-change-detector"
