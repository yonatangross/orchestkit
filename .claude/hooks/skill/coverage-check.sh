#!/bin/bash
# Runs on Stop for testing skills
# Checks if coverage threshold is met

COVERAGE_THRESHOLD=${COVERAGE_THRESHOLD:-80}

echo "::group::Coverage Check"

# Check Python coverage
if [ -f ".coverage" ] || [ -f "coverage.xml" ]; then
  if command -v coverage &> /dev/null; then
    COVERAGE=$(coverage report --fail-under=0 2>/dev/null | grep "TOTAL" | awk '{print $NF}' | tr -d '%')
    if [ -n "$COVERAGE" ]; then
      echo "Python coverage: ${COVERAGE}%"
      if (( $(echo "$COVERAGE < $COVERAGE_THRESHOLD" | bc -l) )); then
        echo "::warning::Coverage ${COVERAGE}% is below threshold ${COVERAGE_THRESHOLD}%"
      else
        echo "Coverage meets threshold"
      fi
    fi
  fi
fi

# Check JS/TS coverage
if [ -d "coverage" ]; then
  if [ -f "coverage/coverage-summary.json" ]; then
    COVERAGE=$(cat coverage/coverage-summary.json | grep -o '"lines":{"total":[0-9]*,"covered":[0-9]*' | head -1)
    if [ -n "$COVERAGE" ]; then
      echo "JavaScript/TypeScript coverage report found"
      echo "Check coverage/lcov-report/index.html for details"
    fi
  fi
fi

echo "::endgroup::"

# Output systemMessage for user visibility
echo '{"systemMessage":"Coverage checked","continue":true}'
exit 0
