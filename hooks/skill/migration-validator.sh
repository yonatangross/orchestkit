#!/bin/bash
# Migration Validator - Validates alembic migration files
# Hook: PostToolUse (Write)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/migration-validator"
