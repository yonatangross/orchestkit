#!/bin/bash
# File Lock Release - Release locks after successful Write/Edit
# Hook: PostToolUse (Write|Edit)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/write-edit/file-lock-release"
