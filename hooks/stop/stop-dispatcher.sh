#!/bin/bash
# Stop Dispatcher - Runs all stop hooks and outputs combined status
# CC 2.1.7 Compliant: silent on success, visible on failure
# Consolidates: multi-instance cleanup, task-completion, auto-save, context-compressor, skill hooks
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$SCRIPT_DIR/../skill"
WARNINGS=()

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Coordination DB path
COORDINATION_DB="${CLAUDE_PROJECT_DIR:-.}/.claude/coordination/.claude.db"

# Helper to run a hook
run_hook() {
  local name="$1"
  local script="$2"

  if [[ ! -f "$script" ]]; then
    return 0
  fi

  local output
  local exit_code
  output=$(bash "$script" 2>&1) && exit_code=0 || exit_code=$?

  if [[ $exit_code -ne 0 ]]; then
    WARNINGS+=("$name: failed")
  elif [[ "$output" == *"warning"* ]] || [[ "$output" == *"Warning"* ]]; then
    local warn_msg=$(echo "$output" | grep -i "warning" | head -1 | sed 's/.*warning[: ]*//')
    [[ -n "$warn_msg" ]] && WARNINGS+=("$name: $warn_msg")
  fi

  return 0
}

# Run stop hooks in order

# 1. Multi-instance cleanup (first, releases locks before other cleanup)
if [[ -f "$COORDINATION_DB" ]]; then
  run_hook "MultiCleanup" "$SCRIPT_DIR/multi-instance-cleanup.sh"
  run_hook "InstanceCleanup" "$SCRIPT_DIR/cleanup-instance.sh"
fi

# 2. Task completion check
run_hook "Tasks" "$SCRIPT_DIR/task-completion-check.sh"

# 3. Auto-save context
run_hook "Context" "$SCRIPT_DIR/auto-save-context.sh"

# 4. Skill hooks (consolidated from direct registrations)
run_hook "Coverage" "$SKILL_DIR/coverage-check.sh"
run_hook "Decisions" "$SKILL_DIR/design-decision-saver.sh"
run_hook "Evidence" "$SKILL_DIR/evidence-collector.sh"
run_hook "Mem0Decisions" "$SKILL_DIR/mem0-decision-saver.sh"

# 5. Mem0 pre-compaction sync (save important context before compaction)
run_hook "Mem0Sync" "$SCRIPT_DIR/mem0-pre-compaction-sync.sh"

# 6. Context compressor (last)
run_hook "Compressor" "$SCRIPT_DIR/context-compressor.sh"

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  jq -n --arg msg "⚠ $WARN_MSG" '{continue:true,systemMessage:$msg}'
else
  # Silent success - no systemMessage
  echo "{\"continue\": true, \"suppressOutput\": true}"
fi

exit 0
