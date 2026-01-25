#!/usr/bin/env bash
# =============================================================================
# Test: Plugin Structure Compliance
# =============================================================================
# Validates that the OrchestKit plugin follows Claude Code plugin standards:
# 1. hooks/hooks.json exists and contains all hooks
# 2. .claude-plugin/plugin.json does NOT contain inline hooks
# 3. Sub-plugins do NOT have hooks (they inherit from main plugin)
#
# This test prevents regression of issue #224 where hooks were incorrectly
# placed inline in plugin.json instead of hooks/hooks.json
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASS=$((PASS + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAIL=$((FAIL + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARN=$((WARN + 1))
}

echo "=========================================="
echo "Plugin Structure Compliance Test"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# Test 1: hooks/hooks.json exists
# -----------------------------------------------------------------------------
echo "Test 1: hooks/hooks.json exists"
if [[ -f "$PROJECT_ROOT/hooks/hooks.json" ]]; then
    pass "hooks/hooks.json exists"
else
    fail "hooks/hooks.json is MISSING - Claude Code requires hooks in hooks/hooks.json"
fi

# -----------------------------------------------------------------------------
# Test 2: hooks/hooks.json is valid JSON
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: hooks/hooks.json is valid JSON"
if [[ -f "$PROJECT_ROOT/hooks/hooks.json" ]]; then
    if jq empty "$PROJECT_ROOT/hooks/hooks.json" 2>/dev/null; then
        pass "hooks/hooks.json is valid JSON"
    else
        fail "hooks/hooks.json is NOT valid JSON"
    fi
else
    fail "Cannot validate - file missing"
fi

# -----------------------------------------------------------------------------
# Test 3: hooks/hooks.json has required structure
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: hooks/hooks.json has required structure"
if [[ -f "$PROJECT_ROOT/hooks/hooks.json" ]]; then
    # Check for "hooks" wrapper object
    if jq -e '.hooks' "$PROJECT_ROOT/hooks/hooks.json" >/dev/null 2>&1; then
        pass "hooks/hooks.json has 'hooks' wrapper object"
    else
        fail "hooks/hooks.json missing 'hooks' wrapper - Claude Code requires {\"hooks\": {...}}"
    fi

    # Check for required hook types
    for hook_type in PreToolUse PostToolUse SessionStart Stop UserPromptSubmit; do
        if jq -e ".hooks.$hook_type" "$PROJECT_ROOT/hooks/hooks.json" >/dev/null 2>&1; then
            pass "hooks/hooks.json has $hook_type hooks"
        else
            fail "hooks/hooks.json missing $hook_type hooks"
        fi
    done
else
    fail "Cannot validate - file missing"
fi

# -----------------------------------------------------------------------------
# Test 4: .claude-plugin/plugin.json does NOT have inline hooks
# -----------------------------------------------------------------------------
echo ""
echo "Test 4: plugins/ork/.claude-plugin/plugin.json does NOT have inline hooks"
PLUGIN_JSON="$PROJECT_ROOT/plugins/ork/.claude-plugin/plugin.json"
if [[ -f "$PLUGIN_JSON" ]]; then
    # Check if hooks field exists and has content
    if jq -e '.hooks' "$PLUGIN_JSON" >/dev/null 2>&1; then
        HOOKS_COUNT=$(jq '.hooks | keys | length' "$PLUGIN_JSON" 2>/dev/null || echo "0")
        if [[ "$HOOKS_COUNT" -gt 0 ]]; then
            fail "plugin.json has inline hooks ($HOOKS_COUNT types) - Claude Code requires hooks in hooks/hooks.json"
        else
            pass "plugin.json hooks field is empty (acceptable)"
        fi
    else
        pass "plugin.json has no inline hooks"
    fi
else
    fail "plugin.json not found"
fi

# -----------------------------------------------------------------------------
# Test 5: plugin.json has required metadata fields
# -----------------------------------------------------------------------------
echo ""
echo "Test 5: plugin.json has required metadata fields"
if [[ -f "$PLUGIN_JSON" ]]; then
    for field in name version description author; do
        if jq -e ".$field" "$PLUGIN_JSON" >/dev/null 2>&1; then
            pass "plugin.json has '$field' field"
        else
            fail "plugin.json missing '$field' field"
        fi
    done
else
    fail "Cannot validate - file missing"
fi

# -----------------------------------------------------------------------------
# Test 6: Sub-plugins do NOT have hooks
# -----------------------------------------------------------------------------
echo ""
echo "Test 6: Sub-plugins do NOT have inline hooks"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
if [[ -d "$PLUGINS_DIR" ]]; then
    SUBPLUGIN_HOOK_VIOLATIONS=0
    for subplugin_json in "$PLUGINS_DIR"/ork-*/.claude-plugin/plugin.json; do
        if [[ -f "$subplugin_json" ]]; then
            SUBPLUGIN_NAME=$(dirname "$(dirname "$subplugin_json")" | xargs basename)
            if jq -e '.hooks' "$subplugin_json" >/dev/null 2>&1; then
                HOOKS_COUNT=$(jq '.hooks | keys | length' "$subplugin_json" 2>/dev/null || echo "0")
                if [[ "$HOOKS_COUNT" -gt 0 ]]; then
                    fail "$SUBPLUGIN_NAME has inline hooks - sub-plugins should NOT have hooks"
                    SUBPLUGIN_HOOK_VIOLATIONS=$((SUBPLUGIN_HOOK_VIOLATIONS + 1))
                fi
            fi
        fi
    done
    if [[ "$SUBPLUGIN_HOOK_VIOLATIONS" -eq 0 ]]; then
        pass "No sub-plugins have inline hooks"
    fi
else
    warn "plugins/ directory not found"
fi

# -----------------------------------------------------------------------------
# Test 7: Hook count matches expected
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: Hook count validation"
if [[ -f "$PROJECT_ROOT/hooks/hooks.json" ]]; then
    # Count total hook commands
    HOOK_COUNT=$(jq '[.hooks[][] | .hooks[]? | .command] | length' "$PROJECT_ROOT/hooks/hooks.json" 2>/dev/null || echo "0")

    # Expected: ~144 hooks (adjust as needed)
    EXPECTED_MIN=100
    EXPECTED_MAX=200

    if [[ "$HOOK_COUNT" -ge "$EXPECTED_MIN" && "$HOOK_COUNT" -le "$EXPECTED_MAX" ]]; then
        pass "Hook count ($HOOK_COUNT) is within expected range ($EXPECTED_MIN-$EXPECTED_MAX)"
    elif [[ "$HOOK_COUNT" -lt "$EXPECTED_MIN" ]]; then
        fail "Hook count ($HOOK_COUNT) is below expected minimum ($EXPECTED_MIN) - hooks may be missing"
    else
        warn "Hook count ($HOOK_COUNT) exceeds expected maximum ($EXPECTED_MAX) - verify this is intentional"
    fi
else
    fail "Cannot validate - file missing"
fi

# -----------------------------------------------------------------------------
# Test 8: marketplace.json references correct source paths
# -----------------------------------------------------------------------------
echo ""
echo "Test 8: marketplace.json validation"
MARKETPLACE_JSON="$PROJECT_ROOT/.claude-plugin/marketplace.json"
if [[ -f "$MARKETPLACE_JSON" ]]; then
    # Check main ork plugin source (should be ./plugins/ork, NOT ./ to prevent auto-install)
    ORK_SOURCE=$(jq -r '.plugins[] | select(.name == "ork") | .source' "$MARKETPLACE_JSON" 2>/dev/null)
    if [[ "$ORK_SOURCE" == "./plugins/ork" ]]; then
        pass "Main ork plugin has correct source (./plugins/ork)"
    elif [[ "$ORK_SOURCE" == "./" ]]; then
        fail "Main ork plugin uses root source (./) - this causes auto-install! Use ./plugins/ork"
    else
        fail "Main ork plugin has incorrect source: $ORK_SOURCE (expected ./plugins/ork)"
    fi

    # Check engine requirement
    ENGINE=$(jq -r '.engine // empty' "$MARKETPLACE_JSON" 2>/dev/null)
    if [[ -n "$ENGINE" ]]; then
        pass "marketplace.json has engine requirement: $ENGINE"
    else
        warn "marketplace.json missing engine field (recommended: >=2.1.19)"
    fi
else
    fail "marketplace.json not found"
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
    echo -e "${RED}FAILED${NC}: $FAIL test(s) failed"
    echo ""
    echo "Fix these issues to ensure Claude Code compliance:"
    echo "1. Hooks must be in hooks/hooks.json (not inline in plugin.json)"
    echo "2. plugin.json should only contain metadata (name, version, author, etc.)"
    echo "3. Sub-plugins should NOT have hooks"
    exit 1
else
    echo -e "${GREEN}PASSED${NC}: All tests passed"
    exit 0
fi
