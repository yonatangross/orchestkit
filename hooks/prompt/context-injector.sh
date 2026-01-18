#!/bin/bash
set -euo pipefail
# Context Injector - Injects relevant context into user prompts
# Hook: UserPromptSubmit

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

PROMPT=$(get_field '.prompt')

log_hook "User prompt received (${#PROMPT} chars)"

# Check for keywords that might benefit from context injection
CONTEXT_HINTS=""

# If prompt mentions issues or bugs, remind about issue docs
if [[ "$PROMPT" =~ (issue|bug|fix|#[0-9]+) ]]; then
  if [[ -d "${CLAUDE_PROJECT_DIR:-.}/docs/issues" ]]; then
    CONTEXT_HINTS="${CONTEXT_HINTS}Check docs/issues/ for issue documentation.
"
  fi
fi

# If prompt mentions testing, remind about test patterns
if [[ "$PROMPT" =~ (test|testing|pytest|jest) ]]; then
  CONTEXT_HINTS="${CONTEXT_HINTS}Remember to use 'tee' for visible test output.
"
fi

# If prompt mentions deployment or CI/CD
if [[ "$PROMPT" =~ (deploy|ci|cd|pipeline|github.actions) ]]; then
  CONTEXT_HINTS="${CONTEXT_HINTS}Check .github/workflows/ for CI configuration.
"
fi

# Log context hints if any
if [[ -n "$CONTEXT_HINTS" ]]; then
  log_hook "Context hints: ${CONTEXT_HINTS//$'
'/ }"
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
