#!/usr/bin/env bash
# Test: Remember-Recall Skills Integration Tests
# Validates that remember and recall skills have aligned user_id, categories, flags, and metadata

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_ROOT="$REPO_ROOT/skills"

REMEMBER_DIR="$SKILLS_ROOT/remember"
RECALL_DIR="$SKILLS_ROOT/recall"
REMEMBER_SKILL="$REMEMBER_DIR/SKILL.md"
RECALL_SKILL="$RECALL_DIR/SKILL.md"

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
echo "Remember-Recall Integration Test Suite"
echo "========================================"
echo ""

# Test 1: Both skills exist
echo "Test 1: Skill Files Exist"
if [[ -f "$REMEMBER_SKILL" && -f "$RECALL_SKILL" ]]; then
  pass_test "Both remember and recall SKILL.md files exist"
else
  fail_test "Missing skill files" "remember: $(test -f "$REMEMBER_SKILL" && echo "exists" || echo "MISSING"), recall: $(test -f "$RECALL_SKILL" && echo "exists" || echo "MISSING")"
fi
echo ""

# Test 2: test_remember_recall_user_id_alignment
echo "Test 2: User ID Alignment"
echo "   Verifying both skills use 'orchestkit-{project}-decisions' format..."

remember_has_project_user_id=$(grep -c "orchestkit-{project-name}-decisions" "$REMEMBER_SKILL" || echo "0")
recall_has_project_user_id=$(grep -c "orchestkit-{project-name}-decisions" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_project_user_id -gt 0 && $recall_has_project_user_id -gt 0 ]]; then
  pass_test "Both skills use project-scoped user_id: orchestkit-{project-name}-decisions"
else
  fail_test "User ID mismatch" "remember: $remember_has_project_user_id occurrences, recall: $recall_has_project_user_id occurrences"
fi
echo ""

# Test 3: test_category_filtering_works
echo "Test 3: Category Filtering Implementation"
echo "   Verifying recall properly adds metadata.category to filters..."

recall_has_category_filter=$(grep -c "metadata.category" "$RECALL_SKILL" || echo "0")

if [[ $recall_has_category_filter -gt 0 ]]; then
  pass_test "Recall skill implements metadata.category filtering (found $recall_has_category_filter references)"
else
  fail_test "Category filtering missing" "No metadata.category references found in recall SKILL.md"
fi
echo ""

# Test 4: test_graph_flag_propagation
echo "Test 4: Graph Flag Propagation"
echo "   Verifying --graph flag adds enable_graph=true..."

remember_has_graph=$(grep -c "enable_graph\|--enable-graph" "$REMEMBER_SKILL" || echo "0")
recall_has_graph=$(grep -c "enable_graph\|--enable-graph" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_graph -gt 0 && $recall_has_graph -gt 0 ]]; then
  pass_test "Both skills support graph flag with enable_graph=true"
else
  fail_test "Graph flag incomplete" "remember: $remember_has_graph occurrences, recall: $recall_has_graph occurrences"
fi
echo ""

# Test 5: test_agent_scoping
echo "Test 5: Agent Scoping"
echo "   Verifying --agent flag adds agent_id to requests..."

remember_has_agent_id=$(grep -c "agent_id.*ork:" "$REMEMBER_SKILL" || echo "0")
recall_has_agent_filter=$(grep -c "agent_id.*ork:" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_agent_id -gt 0 && $recall_has_agent_filter -gt 0 ]]; then
  pass_test "Both skills implement agent scoping with ork:{agent-id} format"
else
  fail_test "Agent scoping incomplete" "remember: $remember_has_agent_id occurrences, recall: $recall_has_agent_filter occurrences"
fi
echo ""

# Test 6: test_global_flag_uses_correct_user_id
echo "Test 6: Global Flag User ID"
echo "   Verifying --global uses orchestkit-global-best-practices..."

remember_has_global_user_id=$(grep -c "orchestkit-global-best-practices" "$REMEMBER_SKILL" || echo "0")
recall_has_global_user_id=$(grep -c "orchestkit-global-best-practices" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_global_user_id -gt 0 && $recall_has_global_user_id -gt 0 ]]; then
  pass_test "Both skills use global user_id: orchestkit-global-best-practices"
else
  fail_test "Global user_id missing" "remember: $remember_has_global_user_id occurrences, recall: $recall_has_global_user_id occurrences"
fi
echo ""

# Test 7: mem0 script integration references
echo "Test 7: mem0 Script Integration"
echo "   Verifying both skills reference correct mem0 scripts..."

remember_has_add_memory=$(grep -c "add-memory.py" "$REMEMBER_SKILL" || echo "0")
recall_has_search_memories=$(grep -c "search-memories.py" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_add_memory -gt 0 && $recall_has_search_memories -gt 0 ]]; then
  pass_test "Both skills reference correct mem0 scripts"
else
  fail_test "mem0 script integration incomplete" "remember (add): $remember_has_add_memory, recall (search): $recall_has_search_memories"
fi
echo ""

# Test 8: Error handling documentation
echo "Test 8: Error Handling Documentation"
echo "   Verifying both skills document error handling..."

remember_has_error_handling=$(grep -c "## Error Handling" "$REMEMBER_SKILL" || echo "0")
recall_has_error_handling=$(grep -c "## Error Handling" "$RECALL_SKILL" || echo "0")

if [[ $remember_has_error_handling -gt 0 && $recall_has_error_handling -gt 0 ]]; then
  pass_test "Both skills document error handling"
else
  fail_test "Error handling documentation missing" "remember: $remember_has_error_handling, recall: $recall_has_error_handling"
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
  echo "The remember and recall skills have inconsistencies that need to be addressed."
  echo "Review the failed tests above for details."
  exit 1
else
  echo "✅ ALL INTEGRATION TESTS PASSED"
  echo ""
  echo "The remember and recall skills are properly integrated with:"
  echo "  - Aligned user_id formats (project-scoped and global)"
  echo "  - Consistent category filtering"
  echo "  - Proper graph flag propagation"
  echo "  - Agent scoping support"
  echo "  - Proper mem0 script integration"
  exit 0
fi