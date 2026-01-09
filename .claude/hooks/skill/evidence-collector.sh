#!/bin/bash
# Runs on Stop for evidence-verification skill
# Collects verification evidence
# CC 2.1.2 Compliant - Context Protocol 2.0

echo "::group::Evidence Collection Summary"
echo ""
echo "========================================"
echo "  VERIFICATION EVIDENCE COLLECTED"
echo "========================================"
echo ""

# Collect exit codes from recent commands
echo "Recent command results:"
if [ -n "$CC_LAST_EXIT_CODE" ]; then
  echo "  Last exit code: $CC_LAST_EXIT_CODE"
fi

# Check for test results
if [ -f "pytest.xml" ] || [ -f "junit.xml" ]; then
  echo "  Test results: Found (XML format)"
fi

if [ -d "test-results" ]; then
  echo "  Test results directory: Found"
  ls test-results/ 2>/dev/null | head -5
fi

# Check for coverage
if [ -f ".coverage" ] || [ -d "coverage" ]; then
  echo "  Coverage data: Found"
fi

# Check for lint results
if [ -f "lint-results.json" ] || [ -f "eslint-report.json" ]; then
  echo "  Lint results: Found"
fi

echo ""
echo "Evidence verification complete."
echo "Update session/state.json with quality_evidence."
echo "========================================"
echo "::endgroup::"

# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0