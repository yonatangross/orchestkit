#!/bin/bash
# Redact Secrets - Warns if potential secrets detected in output
# Hook: PostToolUse (Bash)
# CC 2.1.7 Compliant
exec node "${CLAUDE_PLUGIN_ROOT:-${CLAUDE_PROJECT_DIR:-.}}/hooks/bin/run-hook.mjs" "skill/redact-secrets"
