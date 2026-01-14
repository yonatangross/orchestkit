#!/bin/bash
# SessionStart Unified Dispatcher - Single entry point for all startup hooks
# CC 2.1.7 Compliant: uses hookSpecificOutput.additionalContext for context injection
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
  local ctx_file="$TEMP_DIR/$name.ctx"

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

    # Extract additionalContext if present (CC 2.1.7)
    if echo "$output" | jq -e '.hookSpecificOutput.additionalContext' >/dev/null 2>&1; then
      echo "$output" | jq -r '.hookSpecificOutput.additionalContext // ""' > "$ctx_file"
    fi
  ) &
}

# Collect results from parallel hooks (writes to temp files for reliable multiline handling)
collect_results() {
  local warnings=""
  local messages=""
  local contexts=""

  for name in Context Environment Mem0 PatternSync Analytics; do
    local status_file="$TEMP_DIR/$name.status"
    local output_file="$TEMP_DIR/$name.out"
    local msg_file="$TEMP_DIR/$name.msg"
    local ctx_file="$TEMP_DIR/$name.ctx"

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

      # Collect systemMessages (user-visible)
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

      # Collect additionalContext (for Claude's context)
      if [[ -f "$ctx_file" ]]; then
        local ctx
        ctx=$(cat "$ctx_file")
        if [[ -n "$ctx" && "$ctx" != "null" ]]; then
          if [[ -n "$contexts" ]]; then
            contexts="$contexts"$'\n'"$ctx"
          else
            contexts="$ctx"
          fi
        fi
      fi
    fi
  done

  # Write to temp files for reliable multiline handling
  echo -n "$warnings" > "$TEMP_DIR/_warnings.txt"
  echo -n "$messages" > "$TEMP_DIR/_messages.txt"
  echo -n "$contexts" > "$TEMP_DIR/_contexts.txt"
}

# ============================================================================
# PHASE 1: Run essential hooks in PARALLEL (fast path)
# ============================================================================

run_hook_parallel "Context" "$SCRIPT_DIR/session-context-loader.sh"
run_hook_parallel "Environment" "$SCRIPT_DIR/session-env-setup.sh"
run_hook_parallel "Mem0" "$SCRIPT_DIR/mem0-context-retrieval.sh"
run_hook_parallel "PatternSync" "$SCRIPT_DIR/pattern-sync-pull.sh"
run_hook_parallel "Analytics" "$SCRIPT_DIR/analytics-consent-check.sh"

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

collect_results
WARNINGS=$(cat "$TEMP_DIR/_warnings.txt" 2>/dev/null || echo "")
MESSAGES=$(cat "$TEMP_DIR/_messages.txt" 2>/dev/null || echo "")
CONTEXTS=$(cat "$TEMP_DIR/_contexts.txt" 2>/dev/null || echo "")

# Log agent type if present
if [[ -n "$AGENT_TYPE" ]]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [startup-dispatcher] Agent type: $AGENT_TYPE" >> "${CLAUDE_PROJECT_DIR:-.}/.claude/logs/hooks.log" 2>/dev/null || true
fi

# Build output JSON with hookSpecificOutput.additionalContext for SessionStart
# CC 2.1.7: additionalContext injects into Claude's context, systemMessage shows to user
if [[ -n "$WARNINGS" ]]; then
  # Has warnings - show to user and inject context
  if [[ -n "$CONTEXTS" ]]; then
    jq -nc --arg ctx "$CONTEXTS" --arg msg "⚠ $WARNINGS" \
      '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx},systemMessage:$msg,continue:true}'
  else
    jq -nc --arg msg "⚠ $WARNINGS" '{systemMessage:$msg,continue:true}'
  fi
elif [[ -n "$CONTEXTS" ]]; then
  # Has context - inject silently (CC 2.1.7 SessionStart format)
  jq -nc --arg ctx "$CONTEXTS" \
    '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$ctx},continue:true,suppressOutput:true}'
elif [[ -n "$MESSAGES" ]]; then
  # Has user messages only - show as systemMessage
  jq -nc --arg msg "$MESSAGES" '{systemMessage:$msg,continue:true}'
else
  # Silent success
  echo '{"continue":true,"suppressOutput":true}'
fi

exit 0