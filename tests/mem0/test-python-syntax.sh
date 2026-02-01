#!/bin/bash
# test-python-syntax.sh - Validate Python syntax for all skill scripts
# Ensures all .py files under src/skills/*/scripts/ compile cleanly
#
# Uses py_compile to catch syntax errors without executing the scripts.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

# Test helpers (matching test-mem0-scripts.sh pattern)
test_start() {
    local name="$1"
    echo -n "  ○ $name... "
    TESTS_RUN=$((TESTS_RUN + 1))
}

test_pass() {
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

test_fail() {
    local msg="${1:-}"
    echo -e "${RED}FAIL${NC}"
    if [[ -n "$msg" ]]; then
        echo -e "    ${RED}→ $msg${NC}"
    fi
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

# =============================================================================
# MAIN
# =============================================================================

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Python Syntax Validation${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check python3 availability
if ! command -v python3 &>/dev/null; then
    echo -e "${YELLOW}⚠ python3 not found, skipping syntax validation${NC}"
    exit 0
fi

SKILLS_DIR="$PROJECT_ROOT/src/skills"
FAILED_FILES=()

# Find all .py files under src/skills/*/scripts/
PY_FILES=()
while IFS= read -r -d '' file; do
    PY_FILES+=("$file")
done < <(find "$SKILLS_DIR" -path "*/scripts/*.py" -print0 2>/dev/null)

if [[ ${#PY_FILES[@]} -eq 0 ]]; then
    echo -e "${YELLOW}⚠ No Python scripts found under src/skills/*/scripts/${NC}"
    exit 0
fi

echo -e "Found ${#PY_FILES[@]} Python scripts to validate"
echo ""

# Validate each file
for py_file in "${PY_FILES[@]}"; do
    # Get relative path for display
    rel_path="${py_file#"$PROJECT_ROOT"/}"

    test_start "syntax: $rel_path"

    # Run py_compile to check syntax
    if error_output=$(python3 -m py_compile "$py_file" 2>&1); then
        test_pass
    else
        test_fail "$error_output"
        FAILED_FILES+=("$rel_path")
    fi
done

# =============================================================================
# SUMMARY
# =============================================================================

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Results: ${TESTS_PASSED}/${TESTS_RUN} passed, ${TESTS_FAILED} failed"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ ${#FAILED_FILES[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}Failed files:${NC}"
    for f in "${FAILED_FILES[@]}"; do
        echo -e "  ${RED}✗${NC} $f"
    done
fi

if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
fi

echo -e "${GREEN}All Python scripts have valid syntax${NC}"
exit 0
