#!/bin/bash
# UserPromptSubmit Dispatcher - Runs all prompt hooks and outputs combined status
# CC 2.1.7 Compliant: silent on success, visible on failure
# Consolidates: context-injector, todo-enforcer, memory-context, satisfaction-detector
#
# Performance optimization (2026-01-14):
# - Hooks run in PARALLEL for faster prompt processing
# - ~260ms serial → ~100ms parallel
set -uo pipefail

# Read stdin once and export for child hooks
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Temp directory for parallel hook outputs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Helper to run a hook in background and capture output
run_hook_parallel() {
  local name="$1"
  local script="$2"
  local output_file="$TEMP_DIR/$name.out"
  local status_file="$TEMP_DIR/$name.status"

  if [[ ! -f "$script" ]]; then
    echo "0" > "$status_file"
    return 0
  fi

  # Run hook in background, capture output and exit code
  (
    output=$(echo "$_HOOK_INPUT" | bash "$script" 2>&1) && exit_code=0 || exit_code=$?
    echo "$output" > "$output_file"
    echo "$exit_code" > "$status_file"
  ) &
}

# Collect warnings from parallel hook results
collect_warnings() {
  local result=""

  for name in Context Todo Memory Satisfaction; do
    local status_file="$TEMP_DIR/$name.status"
    local output_file="$TEMP_DIR/$name.out"

    if [[ -f "$status_file" ]]; then
      local exit_code
      exit_code=$(cat "$status_file")

      if [[ "$exit_code" != "0" ]]; then
        if [[ -n "$result" ]]; then
          result="$result; $name: failed"
        else
          result="$name: failed"
        fi
      elif [[ -f "$output_file" ]]; then
        local output
        output=$(cat "$output_file")
        if [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
          local warn_msg
          warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
          if [[ -n "$warn_msg" ]]; then
            if [[ -n "$result" ]]; then
              result="$result; $name: $warn_msg"
            else
              result="$name: $warn_msg"
            fi
          fi
        fi
      fi
    fi
  done

  echo "$result"
}

# Run all prompt hooks in PARALLEL
run_hook_parallel "Context" "$SCRIPT_DIR/context-injector.sh"
run_hook_parallel "Todo" "$SCRIPT_DIR/todo-enforcer.sh"
run_hook_parallel "Memory" "$SCRIPT_DIR/memory-context.sh"
run_hook_parallel "Satisfaction" "$SCRIPT_DIR/satisfaction-detector.sh"

# Wait for all background hooks to complete
wait

# Collect any warnings
WARNINGS_MSG=$(collect_warnings)

# Output: silent on success, show warnings if any
# CC 2.1.7: Don't use suppressOutput: false (redundant), just omit it
if [[ -n "$WARNINGS_MSG" ]]; then
  jq -nc --arg msg "⚠ $WARNINGS_MSG" '{systemMessage:$msg,continue:true}'
else
  # Silent success
  echo '{"continue":true,"suppressOutput":true}'
fi

exit 0