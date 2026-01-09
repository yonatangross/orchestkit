#!/bin/bash
# Context Schema Validator
# Validates context JSON files against their schemas
#
# Usage: ./test-context-schemas.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/.claude/context"
SCHEMAS_DIR="$PROJECT_ROOT/tests/schemas"

VERBOSE="${1:-}"
FAILED=0
PASSED=0
SKIPPED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Context Schema Validation"
echo "=========================================="
echo ""

# Check for ajv-cli or python jsonschema
VALIDATOR=""
if command -v ajv &> /dev/null; then
    VALIDATOR="ajv"
elif command -v python3 &> /dev/null && python3 -c "import jsonschema" 2>/dev/null; then
    VALIDATOR="python"
else
    echo -e "${YELLOW}WARNING: No JSON schema validator found${NC}"
    echo "Install one of: npm install -g ajv-cli OR pip install jsonschema"
    echo ""
    echo "Falling back to basic structure validation..."
    VALIDATOR="basic"
fi

validate_with_ajv() {
    local schema="$1"
    local file="$2"
    ajv validate -s "$schema" -d "$file" 2>&1
}

validate_with_python() {
    local schema="$1"
    local file="$2"
    python3 << EOF
import json
import jsonschema
import sys

try:
    with open('$schema') as f:
        schema = json.load(f)
    with open('$file') as f:
        data = json.load(f)
    jsonschema.validate(data, schema)
    print("valid")
except jsonschema.ValidationError as e:
    print(f"INVALID: {e.message}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
EOF
}

validate_basic() {
    local file="$1"
    local expected_schema="$2"

    # Check if file has $schema field matching expected
    local actual_schema=$(jq -r '."$schema" // ""' "$file" 2>/dev/null)
    if [[ "$actual_schema" == "$expected_schema" ]]; then
        echo "valid"
    else
        echo "INVALID: \$schema mismatch (expected: $expected_schema, got: $actual_schema)"
        return 1
    fi
}

# Validate identity.json
if [[ -f "$CONTEXT_DIR/identity.json" ]]; then
    echo -n "Testing identity.json... "

    if [[ "$VALIDATOR" == "ajv" ]]; then
        result=$(validate_with_ajv "$SCHEMAS_DIR/context-identity.schema.json" "$CONTEXT_DIR/identity.json" 2>&1) && status=0 || status=1
    elif [[ "$VALIDATOR" == "python" ]]; then
        result=$(validate_with_python "$SCHEMAS_DIR/context-identity.schema.json" "$CONTEXT_DIR/identity.json" 2>&1) && status=0 || status=1
    else
        result=$(validate_basic "$CONTEXT_DIR/identity.json" "context://identity/v1" 2>&1) && status=0 || status=1
    fi

    if [[ $status -eq 0 ]]; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        echo "  $result"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} identity.json (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Validate session/state.json
if [[ -f "$CONTEXT_DIR/session/state.json" ]]; then
    echo -n "Testing session/state.json... "

    if [[ "$VALIDATOR" == "ajv" ]]; then
        result=$(validate_with_ajv "$SCHEMAS_DIR/context-session.schema.json" "$CONTEXT_DIR/session/state.json" 2>&1) && status=0 || status=1
    elif [[ "$VALIDATOR" == "python" ]]; then
        result=$(validate_with_python "$SCHEMAS_DIR/context-session.schema.json" "$CONTEXT_DIR/session/state.json" 2>&1) && status=0 || status=1
    else
        result=$(validate_basic "$CONTEXT_DIR/session/state.json" "context://session/v1" 2>&1) && status=0 || status=1
    fi

    if [[ $status -eq 0 ]]; then
        echo -e "${GREEN}PASS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}FAIL${NC}"
        echo "  $result"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} session/state.json (not found)"
    SKIPPED=$((SKIPPED + 1))
fi

# Validate knowledge/*.json files
if [[ -d "$CONTEXT_DIR/knowledge" ]]; then
    while IFS= read -r -d '' json_file; do
        relative="${json_file#$CONTEXT_DIR/}"
        echo -n "Testing $relative... "

        # Basic validation - check it's valid JSON with required _meta field
        if jq -e '._meta' "$json_file" > /dev/null 2>&1; then
            echo -e "${GREEN}PASS${NC}"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}FAIL${NC}"
            echo "  Missing required _meta field"
            FAILED=$((FAILED + 1))
        fi
    done < <(find "$CONTEXT_DIR/knowledge" -name "*.json" -type f -print0 2>/dev/null)
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed, $SKIPPED skipped"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Schema validation errors found${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All context files are valid${NC}"
    exit 0
fi
