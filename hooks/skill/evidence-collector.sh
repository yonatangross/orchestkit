#!/bin/bash
# Runs on Stop for evidence-verification skill
# Collects verification evidence - silent operation
# CC 2.1.6 Compliant - Context Protocol 2.0
set -euo pipefail

LOG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/logs/evidence-collector.log"
mkdir -p "$(dirname "$LOG_FILE")" 2>/dev/null || true

# Log to file instead of stdout (silent operation)
{
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Evidence Collection"

  # Collect exit codes from recent commands
  echo "Recent command results:"
  if [ -n "${CC_LAST_EXIT_CODE:-}" ]; then
    echo "  Last exit code: $CC_LAST_EXIT_CODE"
  fi

  # Check for test results
  if [ -f "pytest.xml" ] || [ -f "junit.xml" ]; then
    echo "  Test results: Found (XML format)"
  fi

  if [ -d "test-results" ]; then
    echo "  Test results directory: Found"
    ls test-results/ 2>/dev/null | head -5 || true
  fi

  # Check for coverage
  if [ -f ".coverage" ] || [ -d "coverage" ]; then
    echo "  Coverage data: Found"
  fi

  # Check for lint results
  if [ -f "lint-results.json" ] || [ -f "eslint-report.json" ]; then
    echo "  Lint results: Found"
  fi

  echo "Evidence verification complete."
} >> "$LOG_FILE" 2>/dev/null || true

# Silent success - no visible output
echo '{"continue":true,"suppressOutput":true}'
exit 0
