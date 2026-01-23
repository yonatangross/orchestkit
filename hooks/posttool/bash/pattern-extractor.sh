#!/bin/bash
# pattern-extractor.sh - Automatic pattern extraction from bash events
# Hook: PostToolUse/Bash (git commit, gh pr merge, test/build results)
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "posttool/bash/pattern-extractor"
