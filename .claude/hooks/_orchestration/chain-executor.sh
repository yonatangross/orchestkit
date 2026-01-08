#!/bin/bash
# Hook Chain Orchestration Executor
# Executes hooks in sequence with output passing, timeout handling, and retry logic

set -euo pipefail

# Source common utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../_lib/common.sh"

# Configuration
CHAIN_CONFIG="${SCRIPT_DIR}/chain-config.json"
CHAIN_LOG_FILE="${HOOK_LOG_DIR}/chain-execution.log"

# Colors for chain execution output
CHAIN_COLOR=$'\033[0;35m'  # Magenta for chain info

# Log chain execution
log_chain() {
  local msg="$1"
  echo "[$(/bin/date '+%Y-%m-%d %H:%M:%S')] [chain-executor] $msg" >> "$CHAIN_LOG_FILE"
}

# Print chain info to stderr
chain_info() {
  echo -e "${CHAIN_COLOR}⛓${NC}  $1" >&2
}

# Execute a single hook with timeout and retry
# Usage: execute_hook "hook-name" "hook-script" "input-data" "timeout" "retry-count"
execute_hook() {
  local hook_name="$1"
  local hook_script="$2"
  local input_data="$3"
  local timeout="$4"
  local retry_count="$5"
  local attempts=0
  local max_attempts=$((retry_count + 1))

  while [[ $attempts -lt $max_attempts ]]; do
    attempts=$((attempts + 1))

    log_chain "Executing hook: $hook_name (attempt $attempts/$max_attempts)"

    # Create temporary file for input
    local input_file=$(mktemp)
    echo "$input_data" > "$input_file"

    # Execute hook with timeout
    local exit_code=0
    local output=""

    if command -v timeout >/dev/null 2>&1; then
      # Linux timeout command
      output=$(timeout "${timeout}s" bash "$hook_script" < "$input_file" 2>&1) || exit_code=$?
    elif command -v gtimeout >/dev/null 2>&1; then
      # macOS with coreutils installed
      output=$(gtimeout "${timeout}s" bash "$hook_script" < "$input_file" 2>&1) || exit_code=$?
    else
      # Fallback: use perl for timeout (macOS compatible)
      output=$(perl -e "alarm ${timeout}; exec @ARGV" bash "$hook_script" < "$input_file" 2>&1) || exit_code=$?
    fi

    # Clean up temp file
    rm -f "$input_file"

    # Check exit code
    if [[ $exit_code -eq 0 ]]; then
      log_chain "Hook $hook_name completed successfully"
      echo "$output"
      return 0
    elif [[ $exit_code -eq 124 ]] || [[ $exit_code -eq 142 ]]; then
      # Timeout occurred (124 = timeout command, 142 = SIGALRM)
      log_chain "Hook $hook_name timed out (${timeout}s)"
      warn "Hook $hook_name timed out after ${timeout}s"

      if [[ $attempts -lt $max_attempts ]]; then
        log_chain "Retrying hook $hook_name..."
        continue
      else
        echo "$output"
        return 124
      fi
    else
      # Other error
      log_chain "Hook $hook_name failed with exit code $exit_code"

      if [[ $attempts -lt $max_attempts ]]; then
        log_chain "Retrying hook $hook_name..."
        continue
      else
        echo "$output"
        return "$exit_code"
      fi
    fi
  done

  # Should not reach here
  return 1
}

# Execute a chain of hooks
# Usage: execute_chain "chain-name" "input-data"
execute_chain() {
  local chain_name="$1"
  local input_data="$2"

  # Check if jq is available
  if ! command -v jq >/dev/null 2>&1; then
    error "jq is required for chain execution"
    return 1
  fi

  # Check if chain config exists
  if [[ ! -f "$CHAIN_CONFIG" ]]; then
    error "Chain config not found: $CHAIN_CONFIG"
    return 1
  fi

  # Check if chain exists and is enabled
  local chain_exists=$(jq -r ".chains.\"$chain_name\" // null" "$CHAIN_CONFIG")
  if [[ "$chain_exists" == "null" ]]; then
    log_chain "Chain not found: $chain_name"
    return 0  # Don't fail if chain doesn't exist
  fi

  local chain_enabled=$(jq -r ".chains.\"$chain_name\".enabled // true" "$CHAIN_CONFIG")
  if [[ "$chain_enabled" != "true" ]]; then
    log_chain "Chain disabled: $chain_name"
    return 0
  fi

  # Get chain configuration
  local description=$(jq -r ".chains.\"$chain_name\".description" "$CHAIN_CONFIG")
  local sequence=$(jq -r ".chains.\"$chain_name\".sequence[]" "$CHAIN_CONFIG")
  local pass_output=$(jq -r ".chains.\"$chain_name\".pass_output_to_next // false" "$CHAIN_CONFIG")
  local stop_on_failure=$(jq -r ".chains.\"$chain_name\".stop_on_failure // false" "$CHAIN_CONFIG")

  chain_info "Executing chain: $chain_name"
  log_chain "Starting chain: $chain_name - $description"

  local current_input="$input_data"
  local chain_failed=false
  local hook_count=0
  local hooks_executed=0
  local hooks_failed=0

  # Count total hooks
  hook_count=$(echo "$sequence" | wc -l | tr -d ' ')

  # Track start time
  local start_time=$(date +%s)

  # Execute each hook in sequence
  while IFS= read -r hook_name; do
    [[ -z "$hook_name" ]] && continue

    hooks_executed=$((hooks_executed + 1))

    # Find hook script
    local hook_script=""
    for hook_dir in "$SCRIPT_DIR/../skill" "$SCRIPT_DIR/../pretool" "$SCRIPT_DIR/../posttool" "$SCRIPT_DIR/../lifecycle"; do
      if [[ -f "$hook_dir/${hook_name}.sh" ]]; then
        hook_script="$hook_dir/${hook_name}.sh"
        break
      fi
    done

    if [[ -z "$hook_script" ]]; then
      warn "Hook script not found: $hook_name"
      log_chain "Hook script not found: $hook_name"
      hooks_failed=$((hooks_failed + 1))

      if [[ "$stop_on_failure" == "true" ]]; then
        chain_failed=true
        break
      fi
      continue
    fi

    # Get hook metadata
    local timeout=$(jq -r ".hook_metadata.\"$hook_name\".timeout_seconds // 30" "$CHAIN_CONFIG")
    local retry_count=$(jq -r ".hook_metadata.\"$hook_name\".retry_count // 0" "$CHAIN_CONFIG")
    local is_critical=$(jq -r ".hook_metadata.\"$hook_name\".critical // false" "$CHAIN_CONFIG")

    chain_info "[$hooks_executed/$hook_count] Running: $hook_name (timeout: ${timeout}s)"

    # Execute hook
    local hook_output=""
    local hook_exit_code=0
    hook_output=$(execute_hook "$hook_name" "$hook_script" "$current_input" "$timeout" "$retry_count") || hook_exit_code=$?

    # Handle hook result
    if [[ $hook_exit_code -ne 0 ]]; then
      hooks_failed=$((hooks_failed + 1))

      if [[ "$is_critical" == "true" ]] || [[ "$stop_on_failure" == "true" ]]; then
        error "Critical hook failed: $hook_name (exit code: $hook_exit_code)"
        log_chain "Critical hook failed: $hook_name - stopping chain"
        chain_failed=true
        break
      else
        warn "Hook failed: $hook_name (exit code: $hook_exit_code) - continuing chain"
        log_chain "Non-critical hook failed: $hook_name - continuing chain"
      fi
    fi

    # Pass output to next hook if configured
    if [[ "$pass_output" == "true" ]] && [[ -n "$hook_output" ]]; then
      current_input="$hook_output"
      log_chain "Passing output from $hook_name to next hook (${#hook_output} bytes)"
    fi

  done <<< "$sequence"

  # Track end time
  local end_time=$(date +%s)
  local duration=$((end_time - start_time))

  # Log chain completion
  if [[ "$chain_failed" == "true" ]]; then
    error "Chain failed: $chain_name (${hooks_executed}/${hook_count} hooks executed, ${hooks_failed} failed) - ${duration}s"
    log_chain "Chain failed: $chain_name - duration: ${duration}s"
    return 1
  else
    success "Chain completed: $chain_name (${hooks_executed}/${hook_count} hooks, ${hooks_failed} failed) - ${duration}s"
    log_chain "Chain completed: $chain_name - duration: ${duration}s"
    return 0
  fi
}

# Get available chains
list_chains() {
  if [[ ! -f "$CHAIN_CONFIG" ]]; then
    echo "Chain config not found: $CHAIN_CONFIG"
    return 1
  fi

  echo "Available chains:"
  jq -r '.chains | keys[]' "$CHAIN_CONFIG" | while read -r chain_name; do
    local description=$(jq -r ".chains.\"$chain_name\".description" "$CHAIN_CONFIG")
    local enabled=$(jq -r ".chains.\"$chain_name\".enabled // true" "$CHAIN_CONFIG")
    local status="enabled"
    [[ "$enabled" != "true" ]] && status="disabled"

    echo "  - $chain_name ($status): $description"
  done
}

# Main execution
main() {
  local command="${1:-}"

  case "$command" in
    "execute")
      local chain_name="${2:-}"
      if [[ -z "$chain_name" ]]; then
        error "Usage: $0 execute <chain-name>"
        exit 1
      fi

      # Read input from stdin
      local input_data=$(read_hook_input)

      execute_chain "$chain_name" "$input_data"
      ;;

    "list")
      list_chains
      ;;

    "validate")
      # Validate chain configuration
      if [[ ! -f "$CHAIN_CONFIG" ]]; then
        error "Chain config not found: $CHAIN_CONFIG"
        exit 1
      fi

      if jq empty "$CHAIN_CONFIG" 2>/dev/null; then
        success "Chain config is valid JSON"
        list_chains
      else
        error "Chain config is invalid JSON"
        exit 1
      fi
      ;;

    *)
      echo "Usage: $0 {execute|list|validate} [chain-name]"
      echo ""
      echo "Commands:"
      echo "  execute <chain>  - Execute a hook chain"
      echo "  list            - List available chains"
      echo "  validate        - Validate chain configuration"
      exit 1
      ;;
  esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
