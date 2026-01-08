#!/bin/bash
set -euo pipefail
# CI Simulation Hook - Reminds to run CI checks before commits
# Hook: PreToolUse (Bash)

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

COMMAND=$(get_field '.tool_input.command')

# Only trigger for git commit commands
if [[ ! "$COMMAND" =~ git\ commit ]]; then
  exit 0
fi

log_hook "Git commit detected - CI reminder"

# Check if CI checks were recently run
CI_MARKER="/tmp/claude-ci-checks-run"
MARKER_AGE_LIMIT=300  # 5 minutes

if [[ -f "$CI_MARKER" ]]; then
  MARKER_AGE=$(($(date +%s) - $(stat -f %m "$CI_MARKER" 2>/dev/null || stat -c %Y "$CI_MARKER" 2>/dev/null)))
  if [[ $MARKER_AGE -lt $MARKER_AGE_LIMIT ]]; then
    # CI checks were run recently, allow commit
    exit 0
  fi
fi

# Show reminder (don't block, just inform)
cat >&2 << 'EOF'
╔══════════════════════════════════════════════════════════════════════════════╗
║  💡 REMINDER: Run CI checks before committing                                ║
╚══════════════════════════════════════════════════════════════════════════════╝

Backend:
  poetry run ruff format --check app/
  poetry run ruff check app/
  poetry run ty check app/ --exclude "app/evaluation/*"

Frontend:
  npm run format:check
  npm run lint
  npm run typecheck

To mark checks as run: touch /tmp/claude-ci-checks-run

EOF

exit 0
