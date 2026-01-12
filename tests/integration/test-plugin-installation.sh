#!/bin/bash
# Plugin Installation Validation Tests
# Ensures SkillForge plugin structure is correct for Claude Code plugin system
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
echo "  SkillForge Plugin Installation Validation"
echo "=============================================="
echo ""

# =============================================================================
# Test 1: Root-level symlinks exist for plugin discovery
# =============================================================================
echo "--- Test 1: Root-level symlinks for plugin discovery ---"

if [[ -L "$PLUGIN_ROOT/skills" ]]; then
  if [[ -d "$PLUGIN_ROOT/skills" ]]; then
    pass "skills symlink exists and points to valid directory"
  else
    fail "skills symlink exists but target is invalid"
  fi
else
  fail "skills symlink missing at root level (required for plugin discovery)"
fi

if [[ -L "$PLUGIN_ROOT/hooks" ]]; then
  if [[ -d "$PLUGIN_ROOT/hooks" ]]; then
    pass "hooks symlink exists and points to valid directory"
  else
    fail "hooks symlink exists but target is invalid"
  fi
else
  fail "hooks symlink missing at root level"
fi

if [[ -L "$PLUGIN_ROOT/agents" ]]; then
  if [[ -d "$PLUGIN_ROOT/agents" ]]; then
    pass "agents symlink exists and points to valid directory"
  else
    fail "agents symlink exists but target is invalid"
  fi
else
  fail "agents symlink missing at root level"
fi

echo ""

# =============================================================================
# Test 2: .claude-plugin/plugin.json exists (required manifest)
# =============================================================================
echo "--- Test 2: Plugin manifest ---"

if [[ -f "$PLUGIN_ROOT/.claude-plugin/plugin.json" ]]; then
  pass ".claude-plugin/plugin.json exists"

  # Validate JSON structure
  if jq -e '.name' "$PLUGIN_ROOT/.claude-plugin/plugin.json" > /dev/null 2>&1; then
    pass "plugin.json has 'name' field"
  else
    fail "plugin.json missing 'name' field"
  fi

  if jq -e '.version' "$PLUGIN_ROOT/.claude-plugin/plugin.json" > /dev/null 2>&1; then
    pass "plugin.json has 'version' field"
  else
    fail "plugin.json missing 'version' field"
  fi
else
  fail ".claude-plugin/plugin.json missing (required for plugin system)"
fi

echo ""

# =============================================================================
# Test 3: settings.json uses ${CLAUDE_PLUGIN_ROOT} for hooks
# =============================================================================
echo "--- Test 3: Hook paths use CLAUDE_PLUGIN_ROOT ---"

SETTINGS_FILE="$PLUGIN_ROOT/.claude/settings.json"
if [[ -f "$SETTINGS_FILE" ]]; then
  # Check for old CLAUDE_PROJECT_DIR references (should NOT exist)
  if grep -q 'CLAUDE_PROJECT_DIR' "$SETTINGS_FILE"; then
    fail "settings.json still uses \$CLAUDE_PROJECT_DIR (should use \${CLAUDE_PLUGIN_ROOT})"
  else
    pass "settings.json does NOT use \$CLAUDE_PROJECT_DIR"
  fi

  # Check for CLAUDE_PLUGIN_ROOT references (should exist)
  if grep -q 'CLAUDE_PLUGIN_ROOT' "$SETTINGS_FILE"; then
    pass "settings.json uses \${CLAUDE_PLUGIN_ROOT}"
  else
    fail "settings.json does NOT use \${CLAUDE_PLUGIN_ROOT}"
  fi
else
  fail ".claude/settings.json not found"
fi

echo ""

# =============================================================================
# Test 4: Skills are discoverable
# =============================================================================
echo "--- Test 4: Skill discovery ---"

SKILL_COUNT=$(find -L "$PLUGIN_ROOT/skills" -maxdepth 2 -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$SKILL_COUNT" -gt 0 ]]; then
  pass "Found $SKILL_COUNT skills with SKILL.md"
else
  fail "No skills found with SKILL.md"
fi

# Check a few key skills
for skill in commit configure explore implement verify; do
  if [[ -f "$PLUGIN_ROOT/skills/$skill/SKILL.md" ]]; then
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
  ((HOOK_COUNT++))
  if [[ ! -x "$hook" ]]; then
    ((NON_EXEC_COUNT++))
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
# Test 6: common.sh uses PLUGIN_ROOT
# =============================================================================
echo "--- Test 6: common.sh plugin compatibility ---"

COMMON_SH="$PLUGIN_ROOT/.claude/hooks/_lib/common.sh"
if [[ -f "$COMMON_SH" ]]; then
  if grep -q 'PLUGIN_ROOT=' "$COMMON_SH"; then
    pass "common.sh defines PLUGIN_ROOT variable"
  else
    fail "common.sh missing PLUGIN_ROOT variable"
  fi

  if grep -q 'CLAUDE_PLUGIN_ROOT' "$COMMON_SH"; then
    pass "common.sh references CLAUDE_PLUGIN_ROOT"
  else
    fail "common.sh does not reference CLAUDE_PLUGIN_ROOT"
  fi
else
  fail "common.sh not found"
fi

echo ""

# =============================================================================
# Test 7: Version consistency
# =============================================================================
echo "--- Test 7: Version consistency ---"

VERSION_PLUGIN=$(jq -r '.version' "$PLUGIN_ROOT/.claude-plugin/plugin.json" 2>/dev/null)
VERSION_ROOT=$(jq -r '.version' "$PLUGIN_ROOT/plugin.json" 2>/dev/null)

if [[ "$VERSION_PLUGIN" == "$VERSION_ROOT" ]]; then
  pass "Version consistent: $VERSION_PLUGIN"
else
  fail "Version mismatch: .claude-plugin/plugin.json=$VERSION_PLUGIN, plugin.json=$VERSION_ROOT"
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

if [[ "$TESTS_FAILED" -gt 0 ]]; then
  echo ""
  echo "${RED}Plugin installation validation FAILED${NC}"
  echo "Fix the above issues to ensure the plugin works when installed via /plugin install"
  exit 1
else
  echo ""
  echo "${GREEN}Plugin installation validation PASSED${NC}"
  exit 0
fi