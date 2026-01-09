#!/bin/bash
set -euo pipefail
# Todo Enforcer - Reminds about todo tracking for complex tasks
# Hook: UserPromptSubmit

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../_lib/common.sh"

PROMPT=$(get_field '.prompt')
PROMPT_LENGTH=${#PROMPT}

log_hook "Prompt length: $PROMPT_LENGTH chars"

# Complex task indicators
COMPLEX_PATTERNS=(
  'implement'
  'refactor'
  'add feature'
  'create.*component'
  'build.*system'
  'fix.*multiple'
  'update.*across'
  'migrate'
)

IS_COMPLEX=false
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
for pattern in "${COMPLEX_PATTERNS[@]}"; do
  if [[ "$PROMPT_LOWER" =~ $pattern ]]; then
    IS_COMPLEX=true
    break
  fi
done

# Long prompts often indicate complex tasks
if [[ $PROMPT_LENGTH -gt 500 ]]; then
  IS_COMPLEX=true
fi

if [[ "$IS_COMPLEX" == "true" ]]; then
  log_hook "Complex task detected - todo tracking recommended"
fi

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
