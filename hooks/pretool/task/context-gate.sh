#!/bin/bash
set -euo pipefail
# Context Gate - Pre-Tool Hook for Task
# CC 2.1.6 Compliant: includes continue field in all outputs
# Prevents context overflow by limiting concurrent background agents
#
# Strategy:
# - Track active background agents in session
# - Block new background spawns when limit exceeded
# - Force sequential execution for expensive operations
# - Suggest context compression when approaching limits
#
# Version: 1.0.0
# Part of Context Engineering 2.0

# Read stdin BEFORE sourcing common.sh to avoid subshell issues
_HOOK_INPUT=$(cat)
export _HOOK_INPUT

source "$(dirname "$0")/../../_lib/common.sh"

# Configuration - Tuned based on context overflow analysis
MAX_CONCURRENT_BACKGROUND=4       # Max background agents at once
MAX_AGENTS_PER_RESPONSE=6         # Max agents in single response
WARNING_THRESHOLD=3               # Warn after this many concurrent
EXPENSIVE_TYPES="test-generator|backend-system-architect|workflow-architect|security-auditor|llm-integrator"

# State tracking
STATE_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/agent-state.json"
SPAWN_LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/subagent-spawns.jsonl"

mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null || true

# Initialize state if missing
init_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo '{
      "active_background": [],
      "session_total": 0,
      "last_cleanup": null,
      "blocked_count": 0
    }' > "$STATE_FILE"
  fi
}

# Count active background agents from spawn log
count_active_background() {
  if [[ ! -f "$SPAWN_LOG" ]]; then
    echo 0
    return
  fi

  # Count agents spawned in last 5 minutes (reasonable timeout for background tasks)
  local cutoff=$(date -v-5M +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "")

  if [[ -z "$cutoff" ]]; then
    # Fallback: count last 10 entries
    tail -10 "$SPAWN_LOG" 2>/dev/null | wc -l | tr -d ' '
    return
  fi

  # Count recent spawns
  local count=0
  while IFS= read -r line; do
    local ts=$(echo "$line" | jq -r '.timestamp // ""' 2>/dev/null)
    if [[ "$ts" > "$cutoff" ]]; then
      ((count++))
    fi
  done < <(tail -20 "$SPAWN_LOG" 2>/dev/null)

  echo "$count"
}

# Count agents being spawned in current response (multi-tool call detection)
count_current_response_agents() {
  # Check spawn log for agents in last 2 seconds (same response)
  if [[ ! -f "$SPAWN_LOG" ]]; then
    echo 0
    return
  fi

  local cutoff=$(date -v-2S +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -d '2 seconds ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "")

  if [[ -z "$cutoff" ]]; then
    echo 0
    return
  fi

  local count=0
  while IFS= read -r line; do
    local ts=$(echo "$line" | jq -r '.timestamp // ""' 2>/dev/null)
    if [[ "$ts" > "$cutoff" ]]; then
      ((count++))
    fi
  done < <(tail -20 "$SPAWN_LOG" 2>/dev/null)

  echo "$count"
}

# Main gate logic
main() {
  init_state

  local subagent_type=$(get_field '.tool_input.subagent_type')
  local description=$(get_field '.tool_input.description')
  local run_in_background=$(get_field '.tool_input.run_in_background')

  log_hook "Context gate check: $subagent_type (background=$run_in_background)"

  # Count current state
  local active_count=$(count_active_background)
  local response_count=$(count_current_response_agents)

  log_hook "Active background: $active_count, Current response: $response_count"

  # Check 1: Too many agents in single response
  if [[ $response_count -ge $MAX_AGENTS_PER_RESPONSE ]]; then
    log_hook "BLOCKED: Too many agents in single response ($response_count >= $MAX_AGENTS_PER_RESPONSE)"

    block_with_error "Context Overflow Protection" "
Too many agents spawned in a single response ($response_count agents).

Maximum allowed: $MAX_AGENTS_PER_RESPONSE per response

SOLUTION: Split into multiple responses or use sequential execution.
Consider using the /context-compression skill first.

Attempted: $subagent_type - $description
"
  fi

  # Check 2: Too many concurrent background agents
  if [[ "$run_in_background" == "true" && $active_count -ge $MAX_CONCURRENT_BACKGROUND ]]; then
    log_hook "BLOCKED: Too many concurrent background agents ($active_count >= $MAX_CONCURRENT_BACKGROUND)"

    # Update blocked count
    jq '.blocked_count += 1' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"

    block_with_error "Background Agent Limit" "
Too many background agents running concurrently ($active_count active).

Maximum allowed: $MAX_CONCURRENT_BACKGROUND concurrent background agents

SOLUTION:
1. Wait for existing agents to complete
2. Run this agent in foreground (remove run_in_background)
3. Use /context-compression to free up context

Attempted: $subagent_type - $description
"
  fi

  # Warning: Approaching limits
  if [[ $active_count -ge $WARNING_THRESHOLD ]]; then
    warn_with_box "Context Budget Warning" "
$active_count background agents active (limit: $MAX_CONCURRENT_BACKGROUND).

Consider:
- Running remaining agents sequentially
- Using /context-compression skill
- Waiting for current agents to complete

Proceeding with: $subagent_type - $description
"
  fi

  # Warning: Expensive agent type
  if [[ "$subagent_type" =~ ^($EXPENSIVE_TYPES)$ && $active_count -ge 2 ]]; then
    warn "Spawning expensive agent ($subagent_type) with $active_count others active"
    log_hook "WARNING: Expensive agent type with multiple active: $subagent_type"
  fi

  # Update session total
  jq '.session_total += 1' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE" 2>/dev/null || true

  # Allow the agent to proceed
  log_hook "Context gate passed: $subagent_type"

  # CC 2.1.6 Compliant: JSON output without ANSI colors
  # (Colors in JSON break JSON parsing)
  echo '{"continue": true, "suppressOutput": true}'
  exit 0
}

main