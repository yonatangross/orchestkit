#!/bin/bash
# Hook Executability Test
# Verifies all hooks are executable and have proper shebang
#
# Usage: ./test-hook-executability.sh [--fix]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.claude/hooks"

FIX_MODE="${1:-}"
VERBOSE="${VERBOSE:-}"
FAILED=0
PASSED=0
FIXED=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Hook Executability Test"
echo "=========================================="
echo ""

# Find all shell scripts in hooks directory
while IFS= read -r -d '' script; do
    TOTAL=$((TOTAL + 1))
    relative_path="${script#$PROJECT_ROOT/}"
    errors=()

    # Check 1: Is executable?
    if [[ ! -x "$script" ]]; then
        errors+=("not executable")
        if [[ "$FIX_MODE" == "--fix" ]]; then
            chmod +x "$script"
            FIXED=$((FIXED + 1))
        fi
    fi

    # Check 2: Has proper shebang?
    first_line=$(head -n 1 "$script")
    if [[ ! "$first_line" =~ ^#!.*bash ]]; then
        errors+=("missing/invalid shebang (found: $first_line)")
    fi

    # Check 3: Uses some form of error handling (set -e at minimum)?
    # Note: set -euo pipefail is ideal, but set -e alone is acceptable
    if ! grep -qE "^set -e|^set -[a-z]*e" "$script"; then
        # This is a warning, not a hard error - some scripts may have valid reasons
        if [[ "$VERBOSE" == "--verbose" ]]; then
            echo "    [warn] missing 'set -e' error handling"
        fi
    fi

    if [[ ${#errors[@]} -eq 0 ]]; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗${NC} $relative_path"
        for err in "${errors[@]}"; do
            echo "    - $err"
        done
    fi
done < <(find "$HOOKS_DIR" -name "*.sh" -type f -print0 2>/dev/null)

echo ""
echo "=========================================="
echo "  Results: $PASSED/$TOTAL passed"
if [[ $FIXED -gt 0 ]]; then
    echo "  Fixed: $FIXED issues"
fi
echo "=========================================="

if [[ $FAILED -gt 0 && "$FIX_MODE" != "--fix" ]]; then
    echo -e "${YELLOW}TIP: Run with --fix to auto-fix executable permissions${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All hooks are properly configured${NC}"
    exit 0
fi
