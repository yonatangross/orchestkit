#!/usr/bin/env bash
# ============================================================================
# Skill Capabilities.json Validation Test Suite
# ============================================================================
# Comprehensive validation of all skill capabilities.json files
# Supports both slim array format (recommended) and legacy object format.
#
# Tests:
# 1. All skills have capabilities.json (file existence)
# 2. All capabilities.json files are valid JSON (syntax check)
# 3. Required fields exist: $schema, name, version, description, capabilities
# 4. Name field matches directory name (consistency check)
# 5. Version follows semver pattern (^\d+\.\d+\.\d+$)
# 6. Capabilities has at least one entry (array or object)
# 7. Token budget is under limit
#
# Usage: ./test-capabilities-json.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

VERBOSE="${1:-}"

# Colors (only if stdout is a terminal)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

# Test counters
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Track failures for detailed reporting
declare -a FAILURES=()

# ============================================================================
# Helper Functions
# ============================================================================

pass() {
    echo -e "  ${GREEN}[PASS]${NC} $1"
    ((PASS_COUNT++)) || true
}

fail() {
    echo -e "  ${RED}[FAIL]${NC} $1"
    FAILURES+=("$1")
    ((FAIL_COUNT++)) || true
}

warn() {
    echo -e "  ${YELLOW}[WARN]${NC} $1"
    ((WARN_COUNT++)) || true
}

info() {
    echo -e "  ${BLUE}[INFO]${NC} $1"
}

verbose() {
    if [[ "$VERBOSE" == "--verbose" ]]; then
        echo -e "  ${BLUE}[DEBUG]${NC} $1"
    fi
}

# Token counting (approximate: 1 token ~ 4 characters)
count_tokens() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local chars
        chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Check if a JSON field exists using jq with proper escaping
check_json_field() {
    local file="$1"
    local field="$2"
    # Use --arg to safely pass the field name to jq
    jq -e --arg f "$field" '.[$f]' "$file" >/dev/null 2>&1
}

# Check if capabilities is array format (slim) or object format (legacy)
is_slim_format() {
    local file="$1"
    jq -e '.capabilities | type == "array"' "$file" >/dev/null 2>&1
}

# ============================================================================
# Test Suite Header
# ============================================================================

echo ""
echo "============================================================================"
echo "  Skill Capabilities.json Validation Test Suite"
echo "============================================================================"
echo ""
echo "Skills directory: $SKILLS_DIR"
echo ""

# Check prerequisites
if ! command -v jq &>/dev/null; then
    echo -e "${RED}ERROR: jq is required but not installed${NC}"
    exit 1
fi

# Count total skills
TOTAL_SKILLS=0
for skill_dir in "$SKILLS_DIR"/*; do
    if [[ -d "$skill_dir" ]]; then
        ((TOTAL_SKILLS++)) || true
    fi
done

echo "Total skill directories found: $TOTAL_SKILLS"
echo ""

# ============================================================================
# Test 1: All skills have capabilities.json (file existence)
# ============================================================================
echo "----------------------------------------------------------------------------"
echo "Test 1: File Existence - All skills must have capabilities.json"
echo "----------------------------------------------------------------------------"

missing_files=0
for skill_dir in "$SKILLS_DIR"/*; do
    if [[ -d "$skill_dir" ]]; then
        skill_name=$(basename "$skill_dir")
        if [[ ! -f "$skill_dir/capabilities.json" ]]; then
            fail "Missing: $skill_name/capabilities.json"
            ((missing_files++)) || true
        else
            verbose "Found: $skill_name/capabilities.json"
        fi
    fi
done

if [[ "$missing_files" -eq 0 ]]; then
    pass "All $TOTAL_SKILLS skills have capabilities.json"
fi

echo ""

# ============================================================================
# Test 2: All capabilities.json files are valid JSON (syntax check)
# ============================================================================
echo "----------------------------------------------------------------------------"
echo "Test 2: JSON Syntax - All capabilities.json must be valid JSON"
echo "----------------------------------------------------------------------------"

invalid_json=0
for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        skill_name=$(basename "$skill_dir")

        if ! output=$(jq empty "$caps_file" 2>&1); then
            fail "Invalid JSON: $skill_name/capabilities.json - $output"
            ((invalid_json++)) || true
        else
            verbose "Valid JSON: $skill_name/capabilities.json"
        fi
    fi
done

if [[ "$invalid_json" -eq 0 ]]; then
    pass "All capabilities.json files are valid JSON"
fi

echo ""

# ============================================================================
# Test 3: Required fields exist
# ============================================================================
echo "----------------------------------------------------------------------------"
echo 'Test 3: Required Fields - Must have $schema, name, version, description, capabilities'
echo "----------------------------------------------------------------------------"

missing_fields=0

for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        skill_name=$(basename "$skill_dir")

        # Skip invalid JSON files
        if ! jq empty "$caps_file" 2>/dev/null; then
            continue
        fi

        # Check each required field using the helper function
        for field in '$schema' 'name' 'version' 'description' 'capabilities'; do
            if ! check_json_field "$caps_file" "$field"; then
                fail "Missing field '$field': $skill_name/capabilities.json"
                ((missing_fields++)) || true
            fi
        done
    fi
done

if [[ "$missing_fields" -eq 0 ]]; then
    pass "All capabilities.json files have required fields"
fi

echo ""

# ============================================================================
# Test 4: Name field matches directory name (consistency check)
# ============================================================================
echo "----------------------------------------------------------------------------"
echo "Test 4: Name Consistency - name field must match directory name"
echo "----------------------------------------------------------------------------"

name_mismatches=0
for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        dir_name=$(basename "$skill_dir")

        # Skip invalid JSON files
        if ! jq empty "$caps_file" 2>/dev/null; then
            continue
        fi

        json_name=$(jq -r '.name // ""' "$caps_file" 2>/dev/null)

        if [[ "$json_name" != "$dir_name" ]]; then
            fail "Name mismatch: directory='$dir_name', json name='$json_name'"
            ((name_mismatches++)) || true
        else
            verbose "Name matches: $dir_name"
        fi
    fi
done

if [[ "$name_mismatches" -eq 0 ]]; then
    pass "All name fields match their directory names"
fi

echo ""

# ============================================================================
# Test 5: Version follows semver pattern
# ============================================================================
echo "----------------------------------------------------------------------------"
echo 'Test 5: Semver Version - version must match pattern ^[0-9]+\.[0-9]+\.[0-9]+$'
echo "----------------------------------------------------------------------------"

invalid_versions=0
semver_pattern='^[0-9]+\.[0-9]+\.[0-9]+$'

for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        skill_name=$(basename "$skill_dir")

        # Skip invalid JSON files
        if ! jq empty "$caps_file" 2>/dev/null; then
            continue
        fi

        version=$(jq -r '.version // ""' "$caps_file" 2>/dev/null)

        if [[ -z "$version" ]]; then
            fail "Missing version: $skill_name/capabilities.json"
            ((invalid_versions++)) || true
        elif [[ ! "$version" =~ $semver_pattern ]]; then
            fail "Invalid semver: $skill_name/capabilities.json - version='$version'"
            ((invalid_versions++)) || true
        else
            verbose "Valid semver: $skill_name - $version"
        fi
    fi
done

if [[ "$invalid_versions" -eq 0 ]]; then
    pass "All version fields follow semver pattern"
fi

echo ""

# ============================================================================
# Test 6: Capabilities has at least one entry (array or object)
# ============================================================================
echo "----------------------------------------------------------------------------"
echo "Test 6: Capabilities Present - capabilities must have at least one entry"
echo "----------------------------------------------------------------------------"

empty_capabilities=0
slim_count=0
legacy_count=0

for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        skill_name=$(basename "$skill_dir")

        # Skip invalid JSON files
        if ! jq empty "$caps_file" 2>/dev/null; then
            continue
        fi

        if is_slim_format "$caps_file"; then
            # Slim array format
            ((slim_count++)) || true
            cap_count=$(jq '.capabilities | length' "$caps_file" 2>/dev/null || echo "0")
        else
            # Legacy object format
            ((legacy_count++)) || true
            cap_count=$(jq '.capabilities | keys | length' "$caps_file" 2>/dev/null || echo "0")
        fi

        if [[ "$cap_count" -eq 0 ]]; then
            fail "Empty capabilities: $skill_name/capabilities.json"
            ((empty_capabilities++)) || true
        else
            verbose "Has $cap_count capabilities: $skill_name"
        fi
    fi
done

if [[ "$empty_capabilities" -eq 0 ]]; then
    pass "All capabilities.json files have at least one capability"
fi

info "Format breakdown: $slim_count slim (array), $legacy_count legacy (object)"

echo ""

# ============================================================================
# Test 7: Token budget is under limit
# ============================================================================
echo "----------------------------------------------------------------------------"
echo "Test 7: Token Budget - capabilities.json should be under 350 tokens"
echo "----------------------------------------------------------------------------"

TOKEN_LIMIT=350
over_budget=0
total_tokens=0

for caps_file in "$SKILLS_DIR"/*/capabilities.json; do
    if [[ -f "$caps_file" ]]; then
        skill_dir=$(dirname "$caps_file")
        skill_name=$(basename "$skill_dir")

        tokens=$(count_tokens "$caps_file")
        total_tokens=$((total_tokens + tokens))

        if [[ "$tokens" -gt "$TOKEN_LIMIT" ]]; then
            fail "Over token budget: $skill_name/capabilities.json ($tokens tokens > $TOKEN_LIMIT limit)"
            ((over_budget++)) || true
        else
            verbose "Within budget: $skill_name ($tokens tokens)"
        fi
    fi
done

if [[ "$over_budget" -eq 0 ]]; then
    pass "All capabilities.json files are under $TOKEN_LIMIT tokens"
fi

# Report average token count
if [[ "$TOTAL_SKILLS" -gt 0 ]]; then
    avg_tokens=$((total_tokens / TOTAL_SKILLS))
    info "Average tokens per capabilities.json: $avg_tokens"
    info "Total tokens for all capabilities.json: $total_tokens"
fi

echo ""

# ============================================================================
# Summary Report
# ============================================================================
echo "============================================================================"
echo "  Test Results Summary"
echo "============================================================================"
echo ""
echo "  Skills tested:  $TOTAL_SKILLS"
echo -e "  ${GREEN}Passed:${NC}         $PASS_COUNT"
echo -e "  ${RED}Failed:${NC}         $FAIL_COUNT"
echo -e "  ${YELLOW}Warnings:${NC}       $WARN_COUNT"
echo ""

if [[ "$FAIL_COUNT" -gt 0 ]]; then
    echo "----------------------------------------------------------------------------"
    echo "  Failures:"
    echo "----------------------------------------------------------------------------"
    for failure in "${FAILURES[@]}"; do
        echo -e "  ${RED}-${NC} $failure"
    done
    echo ""
    echo -e "${RED}FAILED: $FAIL_COUNT test(s) failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: All capabilities.json validation tests passed${NC}"
    exit 0
fi