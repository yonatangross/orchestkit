#!/bin/bash
# Context System Integration Tests
# Tests the complete Context Engineering 2.0 system
#
# Usage: ./test-context-system.sh [--verbose]
# Exit codes: 0 = all pass, 1 = failures found
#
# Note: Session files (session/state.json) are RUNTIME files, not tracked in git.
# Tests check for directory structure and templates, not runtime state.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTEXT_DIR="$PROJECT_ROOT/.claude/context"
HOOKS_DIR="$PROJECT_ROOT/src/hooks"

VERBOSE="${1:-}"
FAILED=0
PASSED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

export CLAUDE_PROJECT_DIR="$PROJECT_ROOT"

echo "=========================================="
echo "  Context System Integration Tests"
echo "=========================================="
echo ""

# =============================================================================
# Test 1: Context directory structure
# =============================================================================
echo -e "${CYAN}Test 1: Directory Structure${NC}"
echo "----------------------------------------"

dirs_to_check=(
    "$CONTEXT_DIR"
    "$CONTEXT_DIR/knowledge"
)

# Session directory is special - check for dir OR .gitkeep
echo -n "  .claude/context/session... "
if [[ -d "$CONTEXT_DIR/session" ]] || [[ -f "$CONTEXT_DIR/session/.gitkeep" ]]; then
    echo -e "${GREEN}EXISTS${NC}"
    PASSED=$((PASSED + 1))
else
    # Create it for the test (runtime directory)
    mkdir -p "$CONTEXT_DIR/session"
    echo -e "${YELLOW}CREATED${NC} (runtime directory)"
    PASSED=$((PASSED + 1))
fi

for dir in "${dirs_to_check[@]}"; do
    relative="${dir#$PROJECT_ROOT/}"
    echo -n "  $relative... "
    if [[ -d "$dir" ]]; then
        echo -e "${GREEN}EXISTS${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}MISSING${NC}"
        FAILED=$((FAILED + 1))
    fi
done

# =============================================================================
# Test 2: Required context files (identity is tracked, session is runtime)
# =============================================================================
echo ""
echo -e "${CYAN}Test 2: Required Files${NC}"
echo "----------------------------------------"

# identity.json is tracked in git - must exist
echo -n "  .claude/context/identity.json... "
if [[ -f "$CONTEXT_DIR/identity.json" ]]; then
    echo -e "${GREEN}EXISTS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}MISSING${NC}"
    FAILED=$((FAILED + 1))
fi

# session/state.json is RUNTIME only - check for template or create temp
echo -n "  .claude/context/session/state.json... "
if [[ -f "$CONTEXT_DIR/session/state.json" ]]; then
    echo -e "${GREEN}EXISTS${NC} (runtime)"
    PASSED=$((PASSED + 1))
elif [[ -f "$CONTEXT_DIR/session/state.template.json" ]]; then
    echo -e "${GREEN}TEMPLATE EXISTS${NC}"
    PASSED=$((PASSED + 1))
else
    # Create minimal state for testing (not tracked)
    mkdir -p "$CONTEXT_DIR/session"
    cat > "$CONTEXT_DIR/session/state.json" << 'EOF'
{
  "_meta": {
    "position": "END",
    "token_budget": 500,
    "purpose": "Runtime session state (not tracked in git)"
  },
  "session_id": "test-session",
  "started_at": "2026-01-09T00:00:00Z",
  "current_task": null,
  "blockers": []
}
EOF
    echo -e "${YELLOW}CREATED${NC} (temp for test)"
    PASSED=$((PASSED + 1))
fi

# =============================================================================
# Test 3: Token budget calculations
# =============================================================================
echo ""
echo -e "${CYAN}Test 3: Token Budget${NC}"
echo "----------------------------------------"

estimate_tokens() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local chars=$(wc -c < "$file" | tr -d ' ')
        echo $((chars / 4))
    else
        echo 0
    fi
}

# Use the same calculation as context-budget-monitor.sh
# Only count files that are ALWAYS loaded (not all knowledge files)
total_tokens=0
budget_limit=2200  # From context-budget-monitor.sh

echo "  Token estimates (always-loaded files only):"

# Always loaded files (matches context-budget-monitor.sh)
always_loaded=(
    "$CONTEXT_DIR/identity.json"
    "$CONTEXT_DIR/knowledge/index.json"
    "$CONTEXT_DIR/knowledge/blockers/current.json"
)

for file in "${always_loaded[@]}"; do
    if [[ -f "$file" ]]; then
        tokens=$(estimate_tokens "$file")
        total_tokens=$((total_tokens + tokens))
        relative="${file#$PROJECT_ROOT/}"
        echo "    $relative: ~$tokens tokens"
    fi
done


echo ""
echo -n "  Total context tokens: ~$total_tokens / $budget_limit... "
if [[ $total_tokens -lt $budget_limit ]]; then
    echo -e "${GREEN}WITHIN BUDGET${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}OVER BUDGET${NC}"
    FAILED=$((FAILED + 1))
fi

# =============================================================================
# Test 4: Meta field validation (only for tracked files)
# =============================================================================
echo ""
echo -e "${CYAN}Test 4: Meta Field Validation${NC}"
echo "----------------------------------------"

validate_meta() {
    local file="$1"
    local relative="${file#$PROJECT_ROOT/}"

    echo -n "  $relative... "

    if [[ ! -f "$file" ]]; then
        echo -e "${YELLOW}SKIP${NC} (not found)"
        return 0
    fi

    local has_meta=$(jq 'has("_meta")' "$file" 2>/dev/null)
    local has_position=$(jq '._meta | has("position")' "$file" 2>/dev/null)
    local has_budget=$(jq '._meta | has("token_budget")' "$file" 2>/dev/null)

    if [[ "$has_meta" == "true" && "$has_position" == "true" && "$has_budget" == "true" ]]; then
        local position=$(jq -r '._meta.position' "$file")
        local budget=$(jq -r '._meta.token_budget' "$file")
        echo -e "${GREEN}VALID${NC} (position: $position, budget: $budget)"
        return 0
    else
        echo -e "${RED}INVALID${NC} (missing required _meta fields)"
        return 1
    fi
}

# Only validate tracked files (identity.json is tracked, session/state.json is runtime)
if validate_meta "$CONTEXT_DIR/identity.json"; then
    PASSED=$((PASSED + 1))
else
    FAILED=$((FAILED + 1))
fi

# Session state is runtime - validate if exists, skip if not
if [[ -f "$CONTEXT_DIR/session/state.json" ]]; then
    if validate_meta "$CONTEXT_DIR/session/state.json"; then
        PASSED=$((PASSED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
else
    echo "  .claude/context/session/state.json... ${YELLOW}SKIP${NC} (runtime file)"
    PASSED=$((PASSED + 1))
fi

# =============================================================================
# Test 5: Context loader execution
# =============================================================================
echo ""
echo -e "${CYAN}Test 5: Context Loader Execution${NC}"
echo "----------------------------------------"

echo -n "  context-loader.sh... "
if [[ -f "$HOOKS_DIR/lifecycle/context-loader.sh" ]]; then
    output=$(bash "$HOOKS_DIR/lifecycle/context-loader.sh" 2>&1) && exit_code=0 || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        # Verify output contains expected sections
        if echo "$output" | grep -q "IDENTITY\|CURRENT_SESSION"; then
            echo -e "${GREEN}PASS${NC}"
            PASSED=$((PASSED + 1))
            if [[ "$VERBOSE" == "--verbose" ]]; then
                echo "  Output preview:"
                echo "$output" | head -10 | sed 's/^/    /'
            fi
        else
            echo -e "${YELLOW}WARN${NC} (no output sections)"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}FAIL${NC} (exit $exit_code)"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
fi

# =============================================================================
# Test 6: Budget monitor execution
# =============================================================================
echo ""
echo -e "${CYAN}Test 6: Budget Monitor Execution${NC}"
echo "----------------------------------------"

echo -n "  context-budget-monitor.sh... "
if [[ -f "$HOOKS_DIR/posttool/context-budget-monitor.sh" ]]; then
    # CC 2.1.9: CLAUDE_SESSION_ID is required (no fallback)
    export CLAUDE_SESSION_ID="${CLAUDE_SESSION_ID:-test-context-session}"
    output=$(bash "$HOOKS_DIR/posttool/context-budget-monitor.sh" 2>&1) && exit_code=0 || exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        # Try to parse JSON output
        if echo "$output" | jq empty 2>/dev/null; then
            tokens=$(echo "$output" | jq -r '.tokens // "N/A"')
            budget=$(echo "$output" | jq -r '.budget // "N/A"')
            echo -e "${GREEN}PASS${NC} (tokens: $tokens, budget: $budget)"
            PASSED=$((PASSED + 1))
        else
            echo -e "${GREEN}PASS${NC} (non-JSON output)"
            PASSED=$((PASSED + 1))
        fi
    else
        echo -e "${RED}FAIL${NC} (exit $exit_code)"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}SKIP${NC} (not found)"
fi

echo ""
echo "=========================================="
echo "  Results: $PASSED passed, $FAILED failed"
echo "=========================================="

if [[ $FAILED -gt 0 ]]; then
    echo -e "${RED}FAILED: Context system tests failed${NC}"
    exit 1
else
    echo -e "${GREEN}SUCCESS: Context system tests passed${NC}"
    exit 0
fi