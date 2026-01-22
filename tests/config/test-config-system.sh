#!/usr/bin/env bash
# OrchestKit Configuration System Test Suite
# Tests all configuration functionality

set -euo pipefail

# Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_LOADER="$PROJECT_ROOT/.claude/scripts/config-loader.sh"

export ORCHESTKIT_ROOT="$PROJECT_ROOT"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test helper
test_case() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    
    TESTS_RUN=$((TESTS_RUN + 1))
    
    if [[ "$expected" == "$actual" ]]; then
        echo -e "${GREEN}✓${NC} $name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC} $name"
        echo "    Expected: $expected"
        echo "    Actual:   $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "============================================"
echo "  OrchestKit Configuration System Tests"
echo "============================================"
echo ""

# -----------------------------------------------------------------------------
# Test 1: JSON Syntax Validation
# -----------------------------------------------------------------------------
echo "=== 1. JSON Syntax Tests ==="

for f in .claude-plugin/plugin.json \
         .claude/schemas/config.schema.json \
         .claude/defaults/config.json \
         .claude/defaults/presets/*.json; do
    if jq empty "$PROJECT_ROOT/$f" 2>/dev/null; then
        test_case "JSON valid: $f" "valid" "valid"
    else
        test_case "JSON valid: $f" "valid" "INVALID"
    fi
done

echo ""

# -----------------------------------------------------------------------------
# Test 2: Config Schema Structure
# -----------------------------------------------------------------------------
echo "=== 2. Schema Structure Tests ==="

# Check required properties exist
has_version=$(jq -e '.properties.version' "$PROJECT_ROOT/.claude/schemas/config.schema.json" > /dev/null 2>&1 && echo "yes" || echo "no")
test_case "Schema has version property" "yes" "$has_version"

has_preset=$(jq -e '.properties.preset' "$PROJECT_ROOT/.claude/schemas/config.schema.json" > /dev/null 2>&1 && echo "yes" || echo "no")
test_case "Schema has preset property" "yes" "$has_preset"

has_skills=$(jq -e '.properties.skills' "$PROJECT_ROOT/.claude/schemas/config.schema.json" > /dev/null 2>&1 && echo "yes" || echo "no")
test_case "Schema has skills property" "yes" "$has_skills"

has_hooks=$(jq -e '.properties.hooks' "$PROJECT_ROOT/.claude/schemas/config.schema.json" > /dev/null 2>&1 && echo "yes" || echo "no")
test_case "Schema has hooks property" "yes" "$has_hooks"

# Check preset enum values
preset_count=$(jq '.properties.preset.enum | length' "$PROJECT_ROOT/.claude/schemas/config.schema.json")
test_case "Schema has 5 preset options" "5" "$preset_count"

echo ""

# -----------------------------------------------------------------------------
# Test 3: Config Loader Functions
# -----------------------------------------------------------------------------
echo "=== 3. Config Loader Tests ==="

# Test with complete preset
export ORCHESTKIT_CONFIG="$PROJECT_ROOT/.claude/defaults/config.json"

# Preset detection
preset=$("$CONFIG_LOADER" get-preset)
test_case "Get preset (complete)" "complete" "$preset"

# Skill enabled checks
result=$("$CONFIG_LOADER" is-skill-enabled "rag-retrieval")
test_case "AI skill enabled (rag-retrieval)" "true" "$result"

result=$("$CONFIG_LOADER" is-skill-enabled "fastapi-advanced")
test_case "Backend skill enabled (fastapi-advanced)" "true" "$result"

# Agent enabled checks
result=$("$CONFIG_LOADER" is-agent-enabled "backend-system-architect")
test_case "Technical agent enabled" "true" "$result"

result=$("$CONFIG_LOADER" is-agent-enabled "market-intelligence")
test_case "Product agent enabled" "true" "$result"

# Hook enabled checks (safety hooks always on)
result=$("$CONFIG_LOADER" is-hook-enabled "git-branch-protection.sh")
test_case "Safety hook enabled (git-branch-protection)" "true" "$result"

result=$("$CONFIG_LOADER" is-hook-enabled "file-guard.sh")
test_case "Safety hook enabled (file-guard)" "true" "$result"

result=$("$CONFIG_LOADER" is-hook-enabled "redact-secrets.sh")
test_case "Safety hook enabled (redact-secrets)" "true" "$result"

# Notification hooks disabled by default
result=$("$CONFIG_LOADER" is-hook-enabled "desktop.sh")
test_case "Notification hook disabled (desktop)" "false" "$result"

result=$("$CONFIG_LOADER" is-hook-enabled "sound.sh")
test_case "Notification hook disabled (sound)" "false" "$result"

# Command enabled
result=$("$CONFIG_LOADER" is-command-enabled "commit")
test_case "Command enabled (commit)" "true" "$result"

echo ""

# -----------------------------------------------------------------------------
# Test 4: Standard Preset
# -----------------------------------------------------------------------------
echo "=== 4. Standard Preset Tests ==="

export ORCHESTKIT_CONFIG="$PROJECT_ROOT/.claude/defaults/presets/standard.json"

preset=$("$CONFIG_LOADER" get-preset)
test_case "Get preset (standard)" "standard" "$preset"

# Skills should be enabled
result=$("$CONFIG_LOADER" is-skill-enabled "rag-retrieval")
test_case "Standard: Skills enabled" "true" "$result"

# Agents should be disabled (product=false, technical=false)
result=$("$CONFIG_LOADER" is-agent-enabled "backend-system-architect")
test_case "Standard: Technical agents disabled" "false" "$result"

result=$("$CONFIG_LOADER" is-agent-enabled "market-intelligence")
test_case "Standard: Product agents disabled" "false" "$result"

echo ""

# -----------------------------------------------------------------------------
# Test 5: Lite Preset
# -----------------------------------------------------------------------------
echo "=== 5. Lite Preset Tests ==="

export ORCHESTKIT_CONFIG="$PROJECT_ROOT/.claude/defaults/presets/lite.json"

preset=$("$CONFIG_LOADER" get-preset)
test_case "Get preset (lite)" "lite" "$preset"

# AI/ML skills should be disabled
result=$("$CONFIG_LOADER" is-skill-enabled "rag-retrieval")
test_case "Lite: AI skills disabled" "false" "$result"

# Testing skills should be enabled
result=$("$CONFIG_LOADER" is-skill-enabled "unit-testing")
test_case "Lite: Testing skills enabled" "true" "$result"

# Security skills should be enabled
result=$("$CONFIG_LOADER" is-skill-enabled "owasp-top-10")
test_case "Lite: Security skills enabled" "true" "$result"

# Safety hooks still enabled
result=$("$CONFIG_LOADER" is-hook-enabled "git-branch-protection.sh")
test_case "Lite: Safety hooks still enabled" "true" "$result"

echo ""

# -----------------------------------------------------------------------------
# Test 6: Hooks-only Preset
# -----------------------------------------------------------------------------
echo "=== 6. Hooks-only Preset Tests ==="

export ORCHESTKIT_CONFIG="$PROJECT_ROOT/.claude/defaults/presets/hooks-only.json"

preset=$("$CONFIG_LOADER" get-preset)
test_case "Get preset (hooks-only)" "hooks-only" "$preset"

# All skills should be disabled
result=$("$CONFIG_LOADER" is-skill-enabled "rag-retrieval")
test_case "Hooks-only: AI skills disabled" "false" "$result"

result=$("$CONFIG_LOADER" is-skill-enabled "unit-testing")
test_case "Hooks-only: Testing skills disabled" "false" "$result"

# Safety hooks ALWAYS enabled regardless of preset
result=$("$CONFIG_LOADER" is-hook-enabled "git-branch-protection.sh")
test_case "Hooks-only: Safety hooks ALWAYS enabled" "true" "$result"

# Commands disabled
result=$("$CONFIG_LOADER" is-command-enabled "commit")
test_case "Hooks-only: Commands disabled" "false" "$result"

echo ""

# -----------------------------------------------------------------------------
# Test 7: Safety Hook Non-Disableability
# -----------------------------------------------------------------------------
echo "=== 7. Safety Hook Protection Tests ==="

# Create a temp config with safety=false (should be ignored)
TEMP_CONFIG=$(mktemp)
cat > "$TEMP_CONFIG" << 'EOF'
{
  "version": "1.0.0",
  "preset": "custom",
  "hooks": {
    "safety": false,
    "disabled": ["git-branch-protection.sh"]
  }
}
EOF

export ORCHESTKIT_CONFIG="$TEMP_CONFIG"

# Safety hooks should STILL be enabled even if config tries to disable them
result=$("$CONFIG_LOADER" is-hook-enabled "git-branch-protection.sh")
test_case "Safety hook cannot be disabled via config" "true" "$result"

result=$("$CONFIG_LOADER" is-hook-enabled "file-guard.sh")
test_case "Safety hook cannot be disabled (file-guard)" "true" "$result"

result=$("$CONFIG_LOADER" is-hook-enabled "redact-secrets.sh")
test_case "Safety hook cannot be disabled (redact-secrets)" "true" "$result"

rm -f "$TEMP_CONFIG"

echo ""

# -----------------------------------------------------------------------------
# Results Summary
# -----------------------------------------------------------------------------
echo "============================================"
echo "  Test Results"
echo "============================================"
echo ""
echo "Total:  $TESTS_RUN"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}SOME TESTS FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}ALL TESTS PASSED${NC}"
    exit 0
fi
