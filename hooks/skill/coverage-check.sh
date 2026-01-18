#!/bin/bash
# Runs on Stop for testing skills
# Checks if coverage threshold is met - silent operation
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs/coverage-check.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}

# Log to file instead of stdout (silent operation)
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Coverage Check"

  # Check Python coverage
  if [ -f ".coverage" ] || [ -f "coverage.xml" ]; then
    if command -v coverage &> /dev/null; then
      COVERAGE=$(coverage report --fail-under=0 2>/dev/null | grep "TOTAL" | awk '{print $NF}' | tr -d '%') || true
      if [ -n "${COVERAGE:-}" ]; then
        echo "Python coverage: ${COVERAGE}%"
        if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
          echo "WARNING: Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%"
        else
          echo "Coverage meets threshold"
        fi
      fi
    fi
  fi

  # Check JS/TS coverage
  if [ -d "coverage" ]; then
    if [ -f "coverage/coverage-summary.json" ]; then
      echo "JavaScript/TypeScript coverage report found"
      echo "Check coverage/lcov-report/index.html for details"
    fi
  fi
} >> "$LOG_FILE" 2>/dev/null || true

# Silent success - no visible output
echo '{"continue":true,"suppressOutput":true}'
exit 0
