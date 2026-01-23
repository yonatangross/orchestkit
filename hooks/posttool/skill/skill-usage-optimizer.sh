#!/bin/bash
# skill-usage-optimizer.sh - Track skill usage and suggest consolidation
# Hook: PostToolUse/Skill
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/skill/skill-usage-optimizer"
