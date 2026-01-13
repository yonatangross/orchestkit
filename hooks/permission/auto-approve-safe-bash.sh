#!/bin/bash
set -euo pipefail
# Auto-Approve Safe Bash - Automatically approves safe bash commands
# Hook: PermissionRequest (Bash)
# CC 2.1.6 Compliant: includes continue field in all outputs

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

COMMAND=$(get_field '.tool_input.command')

log_hook "Evaluating bash command: ${COMMAND:0:50}..."

# Safe command patterns that should be auto-approved
SAFE_PATTERNS=(
  '^git (status|log|diff|branch|show|fetch|pull)'
  '^git checkout'
  '^npm (list|ls|outdated|audit|run|test)'
  '^pnpm (list|ls|outdated|audit|run|test)'
  '^yarn (list|outdated|audit|run|test)'
  '^poetry (show|run|env)'
  '^docker (ps|images|logs|inspect)'
  '^docker-compose (ps|logs)'
  '^docker compose (ps|logs)'
  '^ls'
  '^pwd'
  '^echo'
  '^cat'
  '^head'
  '^tail'
  '^wc'
  '^find'
  '^which'
  '^type'
  '^env'
  '^printenv'
  '^gh (issue|pr|repo|workflow) (list|view|status)'
  '^gh milestone'
  '^pytest'
  '^poetry run pytest'
  '^npm run (test|lint|typecheck|format)'
  '^ruff (check|format)'
  '^ty check'
  '^mypy'
)

for pattern in "${SAFE_PATTERNS[@]}"; do
  if [[ "$COMMAND" =~ $pattern ]]; then
    log_hook "Auto-approved: matches safe pattern '$pattern'"
    # Silent approval - no user-visible output
    output_silent_allow
    exit 0
  fi
done

# Not a recognized safe command - let user decide (silent passthrough)
log_hook "Command requires manual approval"
output_silent_success
exit 0