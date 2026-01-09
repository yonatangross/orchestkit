#!/bin/bash
# Shell Script Syntax Validator
# Validates all .sh files in the hooks directory for syntax errors
#
# Usage: ./test-shell-syntax.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Shell Script Syntax Validation"
echo "=========================================="
echo ""

# Find all shell scripts
while IFS= read -r -d '' script; do
    TOTAL=$((TOTAL + 1))
    relative_path="${script#$PROJECT_ROOT/}"

    # Check syntax using bash -n
    if output=$(bash -n "$script" 2>&1); then
        PASSED=$((PASSED + 1))
        if [[ "$VERBOSE" == "--verbose" ]]; then
            echo -e "${GREEN}✓${NC} $relative_path"
        fi
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗${NC} $relative_path"
        echo "  Error: $output"
    fi
done < <(find "$HOOKS_DIR" -name "*.sh" -type f -print0 2>/dev/null)

echo ""
echo "=========================================="
echo "  Results: $PASSED/$TOTAL passed"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAILED scripts have syntax errors${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All shell scripts have valid syntax${NC}"
    exit 0
fi
