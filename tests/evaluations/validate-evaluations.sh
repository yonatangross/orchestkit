#!/usr/bin/env bash
# validate-evaluations.sh - Validates all evaluation JSON files against schema
# Uses jq for basic JSON validation and structure checks

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

FAILED=0
CHECKED=0

echo "=========================================="
echo "Validating Skill Evaluation Files"
echo "=========================================="
echo

# Find all evaluation files
for eval_file in "$SCRIPT_DIR"/*.eval.json; do
    [[ -f "$eval_file" ]] || continue
    ((CHECKED++)) || true

    filename=$(basename "$eval_file")
    skill_name="${filename%.eval.json}"

    # Check JSON validity
    if ! jq empty "$eval_file" 2>/dev/null; then
        echo "FAIL: $filename - Invalid JSON"
        ((FAILED++)) || true
        continue
    fi

    # Check required fields
    has_skill=$(jq -r 'has("skill")' "$eval_file")
    has_version=$(jq -r 'has("version")' "$eval_file")
    has_evaluations=$(jq -r 'has("evaluations")' "$eval_file")

    if [[ "$has_skill" != "true" ]]; then
        echo "FAIL: $filename - Missing 'skill' field"
        ((FAILED++)) || true
        continue
    fi

    if [[ "$has_version" != "true" ]]; then
        echo "FAIL: $filename - Missing 'version' field"
        ((FAILED++)) || true
        continue
    fi

    if [[ "$has_evaluations" != "true" ]]; then
        echo "FAIL: $filename - Missing 'evaluations' array"
        ((FAILED++)) || true
        continue
    fi

    # Check evaluations array has items
    eval_count=$(jq '.evaluations | length' "$eval_file")
    if [[ "$eval_count" -eq 0 ]]; then
        echo "FAIL: $filename - Empty evaluations array"
        ((FAILED++)) || true
        continue
    fi

    # Check each evaluation has required fields
    invalid_evals=$(jq '[.evaluations[] | select(.id == null or .query == null or .expected_behavior == null)] | length' "$eval_file")
    if [[ "$invalid_evals" -gt 0 ]]; then
        echo "FAIL: $filename - $invalid_evals evaluations missing required fields (id, query, expected_behavior)"
        ((FAILED++)) || true
        continue
    fi

    echo "PASS: $filename ($eval_count evaluations)"
done

echo
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Checked: $CHECKED evaluation files"
echo "Passed:  $((CHECKED - FAILED)) files"
echo "Failed:  $FAILED files"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi

echo
echo "All evaluation files are valid."
exit 0