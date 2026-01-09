#!/bin/bash
# JSON File Validator
# Validates all .json files in the .claude directory for valid JSON syntax
#
# Usage: ./test-json-validity.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CLAUDE_DIR="$PROJECT_ROOT/.claude"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=========================================="
echo "  JSON Syntax Validation"
echo "=========================================="
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${RED}ERROR: jq is required but not installed${NC}"
    exit 1
fi

# Find all JSON files
while IFS= read -r -d '' json_file; do
    TOTAL=$((TOTAL + 1))
    relative_path="${json_file#$PROJECT_ROOT/}"

    # Validate JSON syntax
    if output=$(jq empty "$json_file" 2>&1); then
        PASSED=$((PASSED + 1))
        if [[ "$VERBOSE" == "--verbose" ]]; then
            echo -e "${GREEN}✓${NC} $relative_path"
        fi
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗${NC} $relative_path"
        echo "  Error: $output"
    fi
done < <(find "$CLAUDE_DIR" -name "*.json" -type f -print0 2>/dev/null)

# Also check root plugin.json
if [[ -f "$PROJECT_ROOT/plugin.json" ]]; then
    TOTAL=$((TOTAL + 1))
    if output=$(jq empty "$PROJECT_ROOT/plugin.json" 2>&1); then
        PASSED=$((PASSED + 1))
        if [[ "$VERBOSE" == "--verbose" ]]; then
            echo -e "${GREEN}✓${NC} plugin.json"
        fi
    else
        FAILED=$((FAILED + 1))
        echo -e "${RED}✗${NC} plugin.json"
        echo "  Error: $output"
    fi
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED/$TOTAL passed"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: $FAILED JSON files are invalid${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All JSON files are valid${NC}"
    exit 0
fi
