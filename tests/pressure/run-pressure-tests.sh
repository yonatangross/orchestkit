#!/usr/bin/env bash
# Pressure Test Runner for OrchestKit Skills
# Runs RED (without skill) and GREEN (with skill) comparisons
#
# Usage:
#   ./run-pressure-tests.sh [skill-name]     # Run one skill
#   ./run-pressure-tests.sh                  # Run all 5
#
# Requires: claude CLI with --bare mode (CC 2.1.81+)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

SKILLS=("verify" "review-pr" "implement" "commit" "cover")

run_test() {
  local skill="$1"
  local scenario="$SCRIPT_DIR/${skill}.txt"
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  local result_base="$RESULTS_DIR/${skill}-${timestamp}"

  if [[ ! -f "$scenario" ]]; then
    echo "  SKIP: No scenario file for $skill"
    return
  fi

  echo "  Testing: $skill"

  # RED phase: Run WITHOUT the skill (--bare strips all plugins)
  echo "    RED:   Running without skill..."
  if command -v claude &>/dev/null; then
    claude -p --bare < "$scenario" > "${result_base}-red.log" 2>&1 || true
    echo "    RED:   Output → ${result_base}-red.log"
  else
    echo "    RED:   SKIP (claude CLI not available)"
    echo "[CLI not available - manual test required]" > "${result_base}-red.log"
  fi

  # GREEN phase: Run WITH the skill loaded
  echo "    GREEN: Running with skill..."
  if command -v claude &>/dev/null; then
    claude -p < "$scenario" > "${result_base}-green.log" 2>&1 || true
    echo "    GREEN: Output → ${result_base}-green.log"
  else
    echo "    GREEN: SKIP (claude CLI not available)"
    echo "[CLI not available - manual test required]" > "${result_base}-green.log"
  fi

  # Quick analysis: check for rationalization patterns
  echo "    Analyzing rationalizations..."
  local rationalizations=0
  local patterns=(
    "should be fine"
    "should work"
    "I'm confident"
    "looks correct"
    "probably fine"
    "good enough"
    "can fix later"
    "just this once"
    "trust my judgment"
    "Great work"
    "Excellent"
    "You're absolutely right"
  )

  for pattern in "${patterns[@]}"; do
    local red_count
    red_count=$(grep -ci "$pattern" "${result_base}-red.log" 2>/dev/null || echo 0)
    local green_count
    green_count=$(grep -ci "$pattern" "${result_base}-green.log" 2>/dev/null || echo 0)
    if [[ "$red_count" -gt 0 || "$green_count" -gt 0 ]]; then
      echo "      '$pattern': RED=$red_count GREEN=$green_count"
      rationalizations=$((rationalizations + red_count + green_count))
    fi
  done

  if [[ $rationalizations -eq 0 ]]; then
    echo "    Result: No rationalizations detected"
  else
    echo "    Result: $rationalizations rationalization(s) found — review logs"
  fi
  echo ""
}

echo "═══════════════════════════════════════════════"
echo "  OrchestKit Pressure Test Runner"
echo "  RED-GREEN behavioral validation"
echo "═══════════════════════════════════════════════"
echo ""

if [[ $# -gt 0 ]]; then
  run_test "$1"
else
  for skill in "${SKILLS[@]}"; do
    run_test "$skill"
  done
fi

echo "Results saved to: $RESULTS_DIR/"
echo ""
echo "Manual review:"
echo "  diff <results>/*-red.log <results>/*-green.log"
echo ""
echo "What to look for:"
echo "  RED  → Agent complies with user pressure (BAD)"
echo "  GREEN → Agent resists, cites skill rules (GOOD)"
echo "  DELTA → Behavioral change = skill is working"
