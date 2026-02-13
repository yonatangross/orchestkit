#!/usr/bin/env bash
# Test: Remember-Memory Skills Integration Tests
# Validates that remember and memory skills have aligned user_id, categories, flags, and metadata
# (Migrated from test-remember-recall-integration.sh after recall→memory consolidation)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_ROOT="$REPO_ROOT/src/skills"

REMEMBER_DIR="$SKILLS_ROOT/remember"
MEMORY_DIR="$SKILLS_ROOT/memory"
REMEMBER_SKILL="$REMEMBER_DIR/SKILL.md"
MEMORY_SKILL="$MEMORY_DIR/SKILL.md"

FAILED=0
TOTAL_TESTS=0
PASSED_TESTS=0

# Helper functions
pass_test() {
  echo "✅ PASS: $1"
  PASSED_TESTS=$((PASSED_TESTS + 1))
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

fail_test() {
  echo "❌ FAIL: $1"
  echo "   Detail: $2"
  FAILED=1
  TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

echo "========================================"
echo "Remember-Memory Integration Test Suite"
echo "========================================"
echo ""

# Test 1: Both skills exist
echo "Test 1: Skill Files Exist"
if [[ -f "$REMEMBER_SKILL" && -f "$MEMORY_SKILL" ]]; then
  pass_test "Both remember and memory SKILL.md files exist"
else
  fail_test "Missing skill files" "remember: $(test -f "$REMEMBER_SKILL" && echo "exists" || echo "MISSING"), memory: $(test -f "$MEMORY_SKILL" && echo "exists" || echo "MISSING")"
fi
echo ""

# Test 2: test_category_filtering_works
echo "Test 2: Category Filtering Implementation"
echo "   Verifying memory skill properly adds metadata.category to filters..."

memory_has_category_filter=$(grep -c "metadata.category" "$MEMORY_SKILL" || true)

if [[ $memory_has_category_filter -gt 0 ]]; then
  pass_test "Memory skill implements metadata.category filtering (found $memory_has_category_filter references)"
else
  fail_test "Category filtering missing" "No metadata.category references found in memory SKILL.md"
fi
echo ""

# Test 3: test_agent_scoping
echo "Test 3: Agent Scoping"
echo "   Verifying --agent flag adds agent_id to requests..."

remember_has_agent_id=$(grep -c "agent_id.*ork:" "$REMEMBER_SKILL" || true)
memory_has_agent_filter=$(grep -c "agent_id.*ork:" "$MEMORY_SKILL" || true)

if [[ $remember_has_agent_id -gt 0 && $memory_has_agent_filter -gt 0 ]]; then
  pass_test "Both skills implement agent scoping with ork:{agent-id} format"
else
  fail_test "Agent scoping incomplete" "remember: $remember_has_agent_id occurrences, memory: $memory_has_agent_filter occurrences"
fi
echo ""

# Test 4: Error handling documentation
echo "Test 4: Error Handling Documentation"
echo "   Verifying both skills document error handling..."

remember_has_error_handling=$(grep -c "## Error Handling" "$REMEMBER_SKILL" || true)
memory_has_error_handling=$(grep -c "## Error Handling" "$MEMORY_SKILL" || true)

if [[ $remember_has_error_handling -gt 0 && $memory_has_error_handling -gt 0 ]]; then
  pass_test "Both skills document error handling"
else
  fail_test "Error handling documentation missing" "remember: $remember_has_error_handling, memory: $memory_has_error_handling"
fi
echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $((TOTAL_TESTS - PASSED_TESTS))"
echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ INTEGRATION TEST FAILED"
  echo ""
  echo "The remember and memory skills have inconsistencies that need to be addressed."
  echo "Review the failed tests above for details."
  exit 1
else
  echo "✅ ALL INTEGRATION TESTS PASSED"
  echo ""
  echo "The remember and memory skills are properly integrated with:"
  echo "  - Consistent category filtering"
  echo "  - Agent scoping support"
  echo "  - Error handling documentation"
  exit 0
fi
