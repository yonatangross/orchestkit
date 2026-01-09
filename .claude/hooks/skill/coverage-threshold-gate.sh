#!/bin/bash
# =============================================================================
# coverage-threshold-gate.sh
# BLOCKING: Coverage must meet threshold after implementation
# =============================================================================
set -euo pipefail

# Configuration
THRESHOLD="${COVERAGE_THRESHOLD:-80}"

# Coverage file locations to check
COVERAGE_PATHS=(
    # JavaScript/TypeScript (Jest, Vitest, c8)
    "coverage/coverage-summary.json"
    "coverage/coverage-final.json"
    ".vitest/coverage/coverage-summary.json"

    # Python (coverage.py, pytest-cov)
    "coverage.json"
    ".coverage.json"
    "htmlcov/status.json"
)

# =============================================================================
# Find coverage file
# =============================================================================
COVERAGE_FILE=""
for path in "${COVERAGE_PATHS[@]}"; do
    if [[ -f "$path" ]]; then
        COVERAGE_FILE="$path"
        break
    fi
done

# No coverage file = skip (coverage might not be configured yet)
if [[ -z "$COVERAGE_FILE" ]]; then
    # Only warn if we're in a project that should have coverage
    if [[ -f "package.json" ]] || [[ -f "pyproject.toml" ]] || [[ -f "setup.py" ]]; then
        echo "INFO: No coverage report found. Run tests with coverage:"
        echo "  TypeScript: npm test -- --coverage"
        echo "  Python:     pytest --cov=app --cov-report=json"
    fi
    exit 0
fi

# =============================================================================
# Parse coverage based on file format
# =============================================================================
COVERAGE=""

# Jest/Vitest coverage-summary.json format
if [[ "$COVERAGE_FILE" == *"coverage-summary.json" ]]; then
    if command -v jq &> /dev/null; then
        # Try lines first, then statements
        COVERAGE=$(jq -r '.total.lines.pct // .total.statements.pct // empty' "$COVERAGE_FILE" 2>/dev/null || echo "")
    else
        # Fallback: grep for pct value
        COVERAGE=$(grep -oE '"pct":\s*[0-9.]+' "$COVERAGE_FILE" | head -1 | grep -oE '[0-9.]+' || echo "")
    fi
fi

# coverage.py JSON format
if [[ "$COVERAGE_FILE" == *"coverage.json" ]] || [[ "$COVERAGE_FILE" == *".coverage.json" ]]; then
    if command -v jq &> /dev/null; then
        COVERAGE=$(jq -r '.totals.percent_covered // empty' "$COVERAGE_FILE" 2>/dev/null || echo "")
    fi
fi

# Jest coverage-final.json format (need to calculate)
if [[ "$COVERAGE_FILE" == *"coverage-final.json" ]] && [[ -z "$COVERAGE" ]]; then
    if command -v jq &> /dev/null; then
        # Sum up all file coverage
        TOTAL=$(jq '[.[] | .s | to_entries | .[].value] | add' "$COVERAGE_FILE" 2>/dev/null || echo "0")
        COVERED=$(jq '[.[] | .s | to_entries | map(select(.value > 0)) | length] | add' "$COVERAGE_FILE" 2>/dev/null || echo "0")
        if [[ "$TOTAL" != "0" ]] && [[ -n "$TOTAL" ]]; then
            COVERAGE=$(echo "scale=2; $COVERED * 100 / $TOTAL" | bc 2>/dev/null || echo "")
        fi
    fi
fi

# =============================================================================
# Validate coverage
# =============================================================================
if [[ -z "$COVERAGE" ]]; then
    echo "WARNING: Could not parse coverage from $COVERAGE_FILE"
    echo "  Ensure coverage report is in a supported format"
    exit 0
fi

# Remove decimal for comparison if needed
COVERAGE_INT=$(echo "$COVERAGE" | cut -d'.' -f1)

if [[ $COVERAGE_INT -lt $THRESHOLD ]]; then
    echo "BLOCKED: Coverage ${COVERAGE}% is below threshold ${THRESHOLD}%"
    echo ""
    echo "Coverage report: $COVERAGE_FILE"
    echo ""
    echo "Actions required:"
    echo "  1. Identify uncovered code paths"
    echo "  2. Add tests for critical business logic"
    echo "  3. Re-run tests with coverage:"
    echo ""
    echo "     TypeScript: npm test -- --coverage"
    echo "     Python:     pytest --cov=app --cov-report=term-missing"
    echo ""
    echo "  4. Ensure coverage >= ${THRESHOLD}% before proceeding"
    echo ""
    echo "Tip: Focus on testing:"
    echo "  - Business logic (services, utils)"
    echo "  - Edge cases and error handling"
    echo "  - Critical user flows"
    exit 1
fi

echo "Coverage gate passed: ${COVERAGE}% (threshold: ${THRESHOLD}%)"
# Output systemMessage for user visibility
echo '{"continue":true,"suppressOutput":true}'
exit 0
