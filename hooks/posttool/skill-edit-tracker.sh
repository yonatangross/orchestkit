#!/bin/bash
# Skill Edit Pattern Tracker - PostToolUse Hook
# Hook: PostToolUse (Write|Edit)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/skill-edit-tracker"