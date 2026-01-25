#!/bin/bash
# Plugin Installation Validation Tests
# Ensures OrchestKit plugin structure is correct for Claude Code plugin system
# Updated for CC 2.1.7 flat skills structure
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="${SCRIPT_DIR}/../.."
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  ((TESTS_PASSED++)) || true
}

fail() {
  echo -e "${RED}FAIL${NC}: $1"
  ((TESTS_FAILED++)) || true
}

warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
}

echo "=============================================="
echo "  OrchestKit Plugin Installation Validation"
echo "=============================================="
echo ""

# =============================================================================
# Test 1: Core directories exist (directories or symlinks)
# =============================================================================
echo "--- Test 1: Core directories exist ---"

# CC 2.1.7: skills are in skills/ (flat structure)
if [[ -d "$PLUGIN_ROOT/skills" ]]; then
  pass "skills directory exists"
else
  fail "skills directory missing"
fi

if [[ -d "$PLUGIN_ROOT/hooks" ]]; then
  pass "hooks directory exists"
else
  fail "hooks directory missing"
fi

if [[ -d "$PLUGIN_ROOT/agents" ]]; then
  pass "agents directory exists"
else
  fail "agents directory missing"
fi

echo ""

# =============================================================================
# Test 2: Plugin manifest exists (marketplace architecture)
# =============================================================================
echo "--- Test 2: Plugin manifest ---"

# New marketplace architecture: plugin.json is at plugins/ork/.claude-plugin/plugin.json
# Root .claude-plugin/ only contains marketplace.json
PLUGIN_JSON="$PLUGIN_ROOT/plugins/ork/.claude-plugin/plugin.json"

if [[ -f "$PLUGIN_JSON" ]]; then
  pass "plugins/ork/.claude-plugin/plugin.json exists"

  # Validate JSON structure
  if jq -e '.name' "$PLUGIN_JSON" > /dev/null 2>&1; then
    pass "plugin.json has 'name' field"
  else
    fail "plugin.json missing 'name' field"
  fi

  if jq -e '.version' "$PLUGIN_JSON" > /dev/null 2>&1; then
    pass "plugin.json has 'version' field"
  else
    fail "plugin.json missing 'version' field"
  fi
else
  fail "plugins/ork/.claude-plugin/plugin.json missing (required for plugin system)"
fi

# Verify marketplace.json exists at root
if [[ -f "$PLUGIN_ROOT/.claude-plugin/marketplace.json" ]]; then
  pass ".claude-plugin/marketplace.json exists"
else
  fail ".claude-plugin/marketplace.json missing"
fi

echo ""

# =============================================================================
# Test 3: Hook paths are valid in hooks/hooks.json (Claude Code plugin standard)
# =============================================================================
echo "--- Test 3: Hook paths validation ---"

# Claude Code expects hooks in hooks/hooks.json (not inline in plugin.json)
# This is the correct architecture for Claude Code plugins
HOOKS_CONFIG="$PLUGIN_ROOT/hooks/hooks.json"
if [[ -f "$HOOKS_CONFIG" ]]; then
  # Check that hooks configuration exists
  if jq -e '.hooks' "$HOOKS_CONFIG" > /dev/null 2>&1; then
    pass "hooks/hooks.json has hooks configuration"
  else
    fail "hooks/hooks.json missing hooks configuration"
  fi

  # Check hooks use CLAUDE_PLUGIN_ROOT (required for installed plugins)
  if grep -q 'CLAUDE_PLUGIN_ROOT' "$HOOKS_CONFIG"; then
    pass "hooks/hooks.json uses CLAUDE_PLUGIN_ROOT paths"
  else
    fail "hooks/hooks.json hook paths should use CLAUDE_PLUGIN_ROOT"
  fi

  # Verify at least PreToolUse and PostToolUse hooks exist
  if jq -e '.hooks.PreToolUse' "$HOOKS_CONFIG" > /dev/null 2>&1; then
    pass "hooks/hooks.json has PreToolUse hooks"
  else
    fail "hooks/hooks.json missing PreToolUse hooks"
  fi

  if jq -e '.hooks.PostToolUse' "$HOOKS_CONFIG" > /dev/null 2>&1; then
    pass "hooks/hooks.json has PostToolUse hooks"
  else
    fail "hooks/hooks.json missing PostToolUse hooks"
  fi
else
  fail "hooks/hooks.json not found (Claude Code expects hooks here, not in plugin.json)"
fi
echo ""

# =============================================================================
# Test 4: Skills are discoverable (CC 2.1.7 flat structure)
# =============================================================================
echo "--- Test 4: Skill discovery (CC 2.1.7 flat structure) ---"

# CC 2.1.7 flat structure: skills/<skill-name>/SKILL.md
SKILL_COUNT=$(find -L "$PLUGIN_ROOT/skills" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SKILL_COUNT" -gt 0 ]]; then
  pass "Found $SKILL_COUNT skills with SKILL.md (CC 2.1.7 flat structure)"
else
  fail "No skills found with SKILL.md in CC 2.1.7 structure"
fi

# Check a few key skills exist in flat structure
skill_exists() {
  local skill_name="$1"
  [[ -f "$PLUGIN_ROOT/skills/${skill_name}/SKILL.md" ]]
}

for skill in commit configure explore implement verify; do
  if skill_exists "$skill"; then
    pass "Core skill '$skill' exists"
  else
    fail "Core skill '$skill' missing"
  fi
done

echo ""

# =============================================================================
# Test 5: Hooks are executable
# =============================================================================
echo "--- Test 5: Hook executability ---"

HOOK_COUNT=0
NON_EXEC_COUNT=0

while IFS= read -r hook; do
  ((HOOK_COUNT++)) || true
  if [[ ! -x "$hook" ]]; then
    ((NON_EXEC_COUNT++)) || true
    warn "Hook not executable: $(basename "$hook")"
  fi
done < <(find -L "$PLUGIN_ROOT/hooks" -name "*.sh" -type f 2>/dev/null)

if [[ "$NON_EXEC_COUNT" -eq 0 ]]; then
  pass "All $HOOK_COUNT hooks are executable"
else
  fail "$NON_EXEC_COUNT of $HOOK_COUNT hooks are not executable"
fi

echo ""

# =============================================================================
# Test 6: Common library plugin compatibility (TypeScript or Bash)
# =============================================================================
echo "--- Test 6: common.sh plugin compatibility ---"

# Since v5.1.0, common.sh was migrated to TypeScript
COMMON_TS="$PLUGIN_ROOT/hooks/src/lib/common.ts"
COMMON_SH="$PLUGIN_ROOT/hooks/_lib/common.sh"

if [[ -f "$COMMON_TS" ]]; then
  # TypeScript version - check for project dir functions
  if grep -qE "getProjectDir|CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT" "$COMMON_TS"; then
    pass "common.ts (TypeScript) has plugin path handling"
  else
    fail "common.ts missing plugin path handling"
  fi
elif [[ -f "$COMMON_SH" ]]; then
  if grep -q 'PLUGIN_ROOT=' "$COMMON_SH"; then
    pass "common.sh defines PLUGIN_ROOT variable"
  else
    fail "common.sh missing PLUGIN_ROOT definition"
  fi

  if grep -q 'CLAUDE_PLUGIN_ROOT' "$COMMON_SH"; then
    pass "common.sh references CLAUDE_PLUGIN_ROOT"
  else
    fail "common.sh does not reference CLAUDE_PLUGIN_ROOT"
  fi
else
  fail "Neither hooks/src/lib/common.ts nor hooks/_lib/common.sh found"
fi

echo ""

# =============================================================================
# Test 7: Plugin manifest version valid
# =============================================================================
echo "--- Test 7: Version validation ---"

PLUGIN_VERSION=$(jq -r '.version' "$PLUGIN_ROOT/plugins/ork/.claude-plugin/plugin.json" 2>/dev/null || echo "")

if [[ -n "$PLUGIN_VERSION" && "$PLUGIN_VERSION" != "null" ]]; then
  # Validate semver format (basic check)
  if [[ "$PLUGIN_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    pass "Version valid: $PLUGIN_VERSION"
  else
    fail "Version format invalid: $PLUGIN_VERSION (expected semver)"
  fi
else
  fail "Could not read version from .claude-plugin/plugin.json"
fi

echo ""

# =============================================================================
# Summary
# =============================================================================
echo "=============================================="
echo "  Test Results"
echo "=============================================="
echo "  Passed: $TESTS_PASSED"
echo "  Failed: $TESTS_FAILED"
echo "=============================================="
echo ""

if [[ "$TESTS_FAILED" -gt 0 ]]; then
  echo -e "${RED}Plugin installation validation FAILED${NC}"
  echo "Fix the above issues to ensure the plugin works when installed via /plugin install"
  exit 1
else
  echo -e "${GREEN}Plugin installation validation PASSED${NC}"
  exit 0
fi