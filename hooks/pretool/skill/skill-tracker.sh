#!/bin/bash
# Skill Tracker - Logs skill invocations with analytics
# Hook: PreToolUse (Skill)
# CC 2.1.6: Compliant with analytics tracking
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "pretool/skill/skill-tracker"
