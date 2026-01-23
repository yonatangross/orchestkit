#!/bin/bash
# Mem0 Decision Saver - Extracts and saves design decisions to memory
# Hook: PostToolUse (Skill)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/mem0-decision-saver"
