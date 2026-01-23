#!/bin/bash
# DI Pattern Enforcer - Enforces dependency injection patterns in FastAPI
# Hook: PostToolUse (Write/Edit)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/di-pattern-enforcer"
