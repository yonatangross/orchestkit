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
if [[ -f "$PROJECT_ROOT/src/hooks/hooks.json" ]]; then
    pass "src/hooks/hooks.json exists"
else
    fail "src/hooks/hooks.json is MISSING - Claude Code requires hooks in hooks/hooks.json"
fi

# -----------------------------------------------------------------------------
# Test 2: hooks/hooks.json is valid JSON
# -----------------------------------------------------------------------------
echo ""
echo "Test 2: hooks/hooks.json is valid JSON"
if [[ -f "$PROJECT_ROOT/src/hooks/hooks.json" ]]; then
    if jq empty "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null; then
        pass "src/hooks/hooks.json is valid JSON"
    else
        fail "src/hooks/hooks.json is NOT valid JSON"
    fi
else
    fail "Cannot validate - file missing"
fi

# -----------------------------------------------------------------------------
# Test 3: hooks/hooks.json has required structure
# -----------------------------------------------------------------------------
echo ""
echo "Test 3: hooks/hooks.json has required structure"
if [[ -f "$PROJECT_ROOT/src/hooks/hooks.json" ]]; then
    # Check for "hooks" wrapper object
    if jq -e '.hooks' "$PROJECT_ROOT/src/hooks/hooks.json" >/dev/null 2>&1; then
        pass "src/hooks/hooks.json has 'hooks' wrapper object"
    else
        fail "src/hooks/hooks.json missing 'hooks' wrapper - Claude Code requires {\"hooks\": {...}}"
    fi

    # Check for required hook types
    for hook_type in PreToolUse PostToolUse SessionStart Stop UserPromptSubmit; do
        if jq -e ".hooks.$hook_type" "$PROJECT_ROOT/src/hooks/hooks.json" >/dev/null 2>&1; then
            pass "src/hooks/hooks.json has $hook_type hooks"
        else
            fail "src/hooks/hooks.json missing $hook_type hooks"
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
# Test 7: Hook count matches plugin.json declaration (dynamic validation)
# -----------------------------------------------------------------------------
echo ""
echo "Test 7: Hook count matches declaration"
if [[ -f "$PROJECT_ROOT/src/hooks/hooks.json" ]] && [[ -f "$PLUGIN_JSON" ]]; then
    # Hook counting — delegate to single source of truth
    eval "$("$PROJECT_ROOT/bin/count-hooks.sh")"
    ACTUAL_HOOK_COUNT=$TOTAL

    # Get declared count from plugin.json description
    DESCRIPTION=$(jq -r '.description' "$PLUGIN_JSON" 2>/dev/null)
    DECLARED_HOOK_COUNT=$(echo "$DESCRIPTION" | grep -oE '[0-9]+ hooks' | head -1 | grep -oE '[0-9]+' || echo "0")

    if [[ "$DECLARED_HOOK_COUNT" -eq 0 ]]; then
        warn "No hook count in plugin.json description - add 'N hooks' to description"
    elif [[ "$ACTUAL_HOOK_COUNT" -eq "$DECLARED_HOOK_COUNT" ]]; then
        pass "Hook count matches declaration: $ACTUAL_HOOK_COUNT"
    else
        # Allow ±5 tolerance for minor discrepancies
        DIFF=$((ACTUAL_HOOK_COUNT - DECLARED_HOOK_COUNT))
        if [[ ${DIFF#-} -le 5 ]]; then
            warn "Hook count slightly off: actual=$ACTUAL_HOOK_COUNT, declared=$DECLARED_HOOK_COUNT (within tolerance)"
        else
            fail "Hook count mismatch: actual=$ACTUAL_HOOK_COUNT, declared=$DECLARED_HOOK_COUNT in plugin.json"
        fi
    fi

    # Sanity check: hooks exist
    if [[ "$ACTUAL_HOOK_COUNT" -gt 0 ]]; then
        pass "Hooks exist: $ACTUAL_HOOK_COUNT hook files"
    else
        fail "No hooks found in src/hooks/src/"
    fi
else
    fail "Cannot validate - hooks.json or plugin.json missing"
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
# Test 9: src/ vs plugins/ sync validation
# -----------------------------------------------------------------------------
echo ""
echo "Test 9: src/ vs plugins/ sync validation"

# Count skills in src/ and plugins/ork/
SRC_SKILLS=$(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
PLUGIN_SKILLS=$(find "$PROJECT_ROOT/plugins/ork/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')

if [[ "$SRC_SKILLS" -eq "$PLUGIN_SKILLS" ]]; then
    pass "Skills in sync: src/ ($SRC_SKILLS) = plugins/ork/ ($PLUGIN_SKILLS)"
else
    fail "Skills out of sync: src/ ($SRC_SKILLS) != plugins/ork/ ($PLUGIN_SKILLS) - run 'npm run build'"
fi

# Count agents in src/ and plugins/ork/
SRC_AGENTS=$(find "$PROJECT_ROOT/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
PLUGIN_AGENTS=$(find "$PROJECT_ROOT/plugins/ork/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')

if [[ "$SRC_AGENTS" -eq "$PLUGIN_AGENTS" ]]; then
    pass "Agents in sync: src/ ($SRC_AGENTS) = plugins/ork/ ($PLUGIN_AGENTS)"
else
    fail "Agents out of sync: src/ ($SRC_AGENTS) != plugins/ork/ ($PLUGIN_AGENTS) - run 'npm run build'"
fi

# -----------------------------------------------------------------------------
# Test 10: Required folder structure
# -----------------------------------------------------------------------------
echo ""
echo "Test 10: Required folder structure"

REQUIRED_DIRS=(
    "src/skills"
    "src/agents"
    "src/hooks/src"
    "src/hooks/dist"
    "plugins/ork/.claude-plugin"
    "plugins/ork/skills"
    "plugins/ork/agents"
    # Note: plugins/ork/hooks is NOT required - hooks are provided by ork-core dependency
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [[ -d "$PROJECT_ROOT/$dir" ]]; then
        pass "Directory exists: $dir"
    else
        fail "Missing directory: $dir"
    fi
done

# -----------------------------------------------------------------------------
# Test 11: Plugin-specific structure
# -----------------------------------------------------------------------------
echo ""
echo "Test 11: All plugins have valid structure"

for plugin_dir in "$PROJECT_ROOT/plugins"/*/; do
    if [[ -d "$plugin_dir" ]]; then
        PLUGIN_NAME=$(basename "$plugin_dir")

        # Check for .claude-plugin/plugin.json
        if [[ -f "$plugin_dir.claude-plugin/plugin.json" ]]; then
            # Validate plugin.json is valid JSON
            if jq empty "$plugin_dir.claude-plugin/plugin.json" 2>/dev/null; then
                pass "$PLUGIN_NAME: valid plugin.json"
            else
                fail "$PLUGIN_NAME: invalid JSON in plugin.json"
            fi

            # Check description contains counts
            DESC=$(jq -r '.description // ""' "$plugin_dir.claude-plugin/plugin.json" 2>/dev/null)
            if echo "$DESC" | grep -qE '[0-9]+ skills'; then
                pass "$PLUGIN_NAME: description has skill count"
            else
                warn "$PLUGIN_NAME: description missing skill count"
            fi
        else
            fail "$PLUGIN_NAME: missing .claude-plugin/plugin.json"
        fi
    fi
done

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
