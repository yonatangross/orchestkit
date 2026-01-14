#!/bin/bash
# SessionStart Unified Dispatcher - Single entry point for all startup hooks
# CC 2.1.7 Compliant: silent on success, visible on failure
#
# Performance optimizations (2026-01-14):
# - Single dispatcher (was 2 separate hooks)
# - PARALLEL execution where possible
# - Coordination is OPT-IN via CLAUDE_MULTI_INSTANCE=1
# - Fast path: essential hooks only (~50ms)
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Temp directory for parallel hook outputs
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Read and parse hook input (CC 2.1.6 format)
HOOK_INPUT=$(cat)
export HOOK_INPUT

# Extract agent_type from hook input (CC 2.1.6 feature)
AGENT_TYPE=""
if command -v jq >/dev/null 2>&1 && [[ -n "$HOOK_INPUT" ]]; then
  AGENT_TYPE=$(echo "$HOOK_INPUT" | jq -r '.agent_type // ""' 2>/dev/null || echo "")
fi
export AGENT_TYPE

# Helper to run a hook in background (parallel)
run_hook_parallel() {
  local name="$1"
  local script="$2"
  local output_file="$TEMP_DIR/$name.out"
  local status_file="$TEMP_DIR/$name.status"
  local msg_file="$TEMP_DIR/$name.msg"

  if [[ ! -f "$script" ]]; then
    echo "0" > "$status_file"
    return 0
  fi

  (
    output=$(HOOK_INPUT="$HOOK_INPUT" AGENT_TYPE="$AGENT_TYPE" bash "$script" 2>&1) && exit_code=0 || exit_code=$?
    echo "$output" > "$output_file"
    echo "$exit_code" > "$status_file"

    # Extract systemMessage if present
    if echo "$output" | jq -e '.systemMessage' >/dev/null 2>&1; then
      echo "$output" | jq -r '.systemMessage // ""' > "$msg_file"
    fi
  ) &
}

# Collect results from parallel hooks
collect_results() {
  local warnings=""
  local messages=""

  for name in Context Environment Mem0 PatternSync; do
    local status_file="$TEMP_DIR/$name.status"
    local output_file="$TEMP_DIR/$name.out"
    local msg_file="$TEMP_DIR/$name.msg"

    if [[ -f "$status_file" ]]; then
      local exit_code
      exit_code=$(cat "$status_file")

      if [[ "$exit_code" != "0" ]]; then
        if [[ -n "$warnings" ]]; then
          warnings="$warnings; $name: failed"
        else
          warnings="$name: failed"
        fi
      fi

      # Collect systemMessages
      if [[ -f "$msg_file" ]]; then
        local msg
        msg=$(cat "$msg_file")
        if [[ -n "$msg" && "$msg" != "null" ]]; then
          if [[ -n "$messages" ]]; then
            messages="$messages"$'\n'"$msg"
          else
            messages="$msg"
          fi
        fi
      fi
    fi
  done

  echo "WARNINGS:$warnings"
  echo "MESSAGES:$messages"
}

# ============================================================================
# PHASE 1: Run essential hooks in PARALLEL (fast path)
# ============================================================================

run_hook_parallel "Context" "$SCRIPT_DIR/session-context-loader.sh"
run_hook_parallel "Environment" "$SCRIPT_DIR/session-env-setup.sh"
run_hook_parallel "Mem0" "$SCRIPT_DIR/mem0-context-retrieval.sh"
run_hook_parallel "PatternSync" "$SCRIPT_DIR/pattern-sync-pull.sh"

# Wait for all parallel hooks
wait

# ============================================================================
# PHASE 2: Multi-instance coordination (OPT-IN, runs after essential hooks)
# ============================================================================

if [[ "${CLAUDE_MULTI_INSTANCE:-0}" == "1" ]]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    # These run sequentially since they depend on each other
    HOOK_INPUT="$HOOK_INPUT" AGENT_TYPE="$AGENT_TYPE" bash "$SCRIPT_DIR/multi-instance-init.sh" >/dev/null 2>&1 || true
    HOOK_INPUT="$HOOK_INPUT" AGENT_TYPE="$AGENT_TYPE" bash "$SCRIPT_DIR/coordination-init.sh" >/dev/null 2>&1 || true

    COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"
    if [[ -f "$COORDINATION_DB" ]]; then
      HOOK_INPUT="$HOOK_INPUT" AGENT_TYPE="$AGENT_TYPE" bash "$SCRIPT_DIR/instance-heartbeat.sh" >/dev/null 2>&1 || true
    fi
  fi
fi

# ============================================================================
# PHASE 3: Collect results and output
# ============================================================================

RESULTS=$(collect_results)
WARNINGS=$(echo "$RESULTS" | grep "^WARNINGS:" | sed 's/^WARNINGS://')
MESSAGES=$(echo "$RESULTS" | grep "^MESSAGES:" | sed 's/^MESSAGES://')

# Log agent type if present
if [[ -n "$AGENT_TYPE" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [startup-dispatcher] Agent type: $AGENT_TYPE" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log" 2>/dev/null || true
fi

# Build output JSON
if [[ -n "$WARNINGS" ]]; then
  # Has warnings
  if [[ -n "$MESSAGES" ]]; then
    echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARNINGS}${RESET}\n${MESSAGES}\", \"continue\": true}"
  else
    echo "{\"systemMessage\": \"${YELLOW}⚠ ${WARNINGS}${RESET}\", \"continue\": true}"
  fi
elif [[ -n "$MESSAGES" ]]; then
  # Has messages but no warnings
  echo "{\"systemMessage\": \"${MESSAGES}\", \"continue\": true}"
else
  # Silent success
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0