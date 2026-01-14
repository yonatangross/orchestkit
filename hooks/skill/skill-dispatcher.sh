#!/bin/bash
# Skill Dispatcher - Consolidates skill hooks for Stop event
# CC 2.1.6 Compliant: silent on success, visible on failure
#
# Consolidates:
# - coverage-check.sh
# - design-decision-saver.sh
# - evidence-collector.sh
# - review-summary-generator.sh
# - security-summary.sh
# - eval-metrics-collector.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WARNINGS=()

# ANSI colors
YELLOW=$'\033[33m'
RESET=$'\033[0m'

# Helper to run a sub-hook
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

# Run skill hooks in order (all are data collection, not blocking)
run_hook "CoverageCheck" "$SCRIPT_DIR/coverage-check.sh"
run_hook "DesignDecisionSaver" "$SCRIPT_DIR/design-decision-saver.sh"
run_hook "EvidenceCollector" "$SCRIPT_DIR/evidence-collector.sh"
run_hook "ReviewSummary" "$SCRIPT_DIR/review-summary-generator.sh"
run_hook "SecuritySummary" "$SCRIPT_DIR/security-summary.sh"
run_hook "EvalMetrics" "$SCRIPT_DIR/eval-metrics-collector.sh"

# Output: silent on success, show warnings if any
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  WARN_MSG=$(IFS="; "; echo "${WARNINGS[*]}")
  jq -n --arg msg "⚠ Skills: $WARN_MSG" '{continue:true,systemMessage:$msg}'
else
  # Silent success
  echo '{"continue": true, "suppressOutput": true}'
fi

exit 0