#!/bin/bash
# Backend File Naming - Validates backend file naming conventions
# Hook: PreToolUse (Write/Edit)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/backend-file-naming"
