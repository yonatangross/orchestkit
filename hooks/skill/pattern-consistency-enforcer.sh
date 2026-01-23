#!/bin/bash
# Pattern Consistency Enforcer - Enforces consistent patterns across instances
# Hook: PostToolUse (Write/Edit)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/pattern-consistency-enforcer"
