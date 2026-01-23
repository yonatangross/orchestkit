#!/bin/bash
# Merge Readiness Checker - Comprehensive merge readiness check
# Hook: PreToolUse (Bash)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/merge-readiness-checker"
