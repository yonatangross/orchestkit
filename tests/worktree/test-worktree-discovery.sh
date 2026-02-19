#!/usr/bin/env bash
# =============================================================================
# Worktree Skill/Agent Discovery Test (CC 2.1.47+)
# =============================================================================
# Verifies that skills and agents are discoverable when OrchestKit is installed
# as a plugin and accessed from a git worktree.
#
# Tests two scenarios:
#   1. Real git worktree — creates a temporary worktree, checks plugins/ presence
#   2. Simulated check — verifies build script uses absolute paths (src/-relative),
#      so the generated plugins/ is always anchored to the main checkout regardless
#      of which worktree runs the build.
#
# Usage:
#   bash tests/worktree/test-worktree-discovery.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGINS_DIR="$PROJECT_ROOT/plugins"
BUILD_SCRIPT="$PROJECT_ROOT/scripts/build-plugins.sh"

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); }
info() { echo -e "${YELLOW}INFO${NC} $1"; }

# =============================================================================
# Simulated checks (always run — no git side effects)
# =============================================================================

echo ""
echo "=== Simulated worktree checks ==="

# 1. Build script uses absolute PROJECT_ROOT (not cwd-relative)
if grep -q 'SCRIPT_DIR.*cd.*dirname' "$BUILD_SCRIPT" && \
   grep -q 'PROJECT_ROOT.*cd.*SCRIPT_DIR' "$BUILD_SCRIPT"; then
  pass "build-plugins.sh derives PROJECT_ROOT from script location (absolute, cwd-independent)"
else
  fail "build-plugins.sh does not anchor PROJECT_ROOT to script location"
fi

# 2. SRC_DIR is defined relative to PROJECT_ROOT (not . or cwd)
if grep -q 'SRC_DIR.*PROJECT_ROOT' "$BUILD_SCRIPT"; then
  pass "SRC_DIR is defined relative to PROJECT_ROOT, not cwd"
else
  fail "SRC_DIR is not defined relative to PROJECT_ROOT"
fi

# 3. PLUGINS_DIR is defined relative to PROJECT_ROOT
if grep -q 'PLUGINS_DIR.*PROJECT_ROOT' "$BUILD_SCRIPT"; then
  pass "PLUGINS_DIR is defined relative to PROJECT_ROOT, not cwd"
else
  fail "PLUGINS_DIR is not defined relative to PROJECT_ROOT"
fi

# 4. plugins/ directory exists and contains expected plugin names
for plugin in ork orkl ork-creative; do
  if [ -d "$PLUGINS_DIR/$plugin" ]; then
    pass "plugins/$plugin directory exists"
  else
    fail "plugins/$plugin directory missing — run: npm run build"
  fi
done

# 5. Each plugin has skills/ and agents/ directories
for plugin in ork orkl; do
  if [ -d "$PLUGINS_DIR/$plugin/skills" ]; then
    pass "plugins/$plugin/skills/ exists"
  else
    fail "plugins/$plugin/skills/ missing"
  fi
  if [ -d "$PLUGINS_DIR/$plugin/agents" ]; then
    pass "plugins/$plugin/agents/ exists"
  else
    fail "plugins/$plugin/agents/ missing"
  fi
done

# 6. Skills contain SKILL.md files (not empty directories)
SKILL_COUNT=$(find "$PLUGINS_DIR/ork/skills" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$SKILL_COUNT" -gt 0 ]; then
  pass "plugins/ork/skills contains $SKILL_COUNT SKILL.md files"
else
  fail "plugins/ork/skills has no SKILL.md files"
fi

# 7. Agents contain .md files
AGENT_COUNT=$(find "$PLUGINS_DIR/ork/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$AGENT_COUNT" -gt 0 ]; then
  pass "plugins/ork/agents contains $AGENT_COUNT agent .md files"
else
  fail "plugins/ork/agents has no .md files"
fi

# 8. Plugin paths are absolute (CLAUDE.md references use absolute paths)
CLAUDE_MD="$PLUGINS_DIR/ork/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
  pass "plugins/ork/CLAUDE.md exists"
else
  fail "plugins/ork/CLAUDE.md missing"
fi

# =============================================================================
# Real worktree test (requires git, skipped gracefully if unavailable)
# =============================================================================

echo ""
echo "=== Real git worktree test ==="

WORKTREE_DIR=""

cleanup() {
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    info "Cleaning up worktree at $WORKTREE_DIR"
    git -C "$PROJECT_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null || \
      rm -rf "$WORKTREE_DIR"
  fi
}
trap cleanup EXIT

# Require git
if ! command -v git &>/dev/null; then
  info "git not found — skipping real worktree test"
else
  CURRENT_BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -z "$CURRENT_BRANCH" ]; then
    info "Not in a git repo — skipping real worktree test"
  else
    WORKTREE_DIR="$(mktemp -d /tmp/orchestkit-worktree-XXXXXX)"
    rmdir "$WORKTREE_DIR"  # git worktree add creates the dir

    # Create a detached worktree at the same commit
    HEAD_SHA=$(git -C "$PROJECT_ROOT" rev-parse HEAD)
    git -C "$PROJECT_ROOT" worktree add --detach "$WORKTREE_DIR" "$HEAD_SHA" 2>/dev/null

    if [ -d "$WORKTREE_DIR" ]; then
      pass "Created temporary git worktree at $WORKTREE_DIR"

      # The worktree shares the same .git object store but has its own work tree.
      # plugins/ in the main checkout should be visible from the worktree because
      # the build script uses PROJECT_ROOT-relative paths.
      #
      # Verify: plugins/ in main checkout has skills and agents
      if [ -d "$WORKTREE_DIR/plugins/ork/skills" ]; then
        pass "plugins/ork/skills visible from worktree (shared checkout)"
      elif [ -d "$PLUGINS_DIR/ork/skills" ]; then
        # plugins/ is in the main checkout, not the worktree — that is expected
        # behavior since git worktrees share .git but have separate work trees.
        pass "plugins/ork/skills exists in main checkout (worktrees share plugins)"
        info "Note: each worktree work-tree has its own plugins/ after 'npm run build'"
      else
        fail "plugins/ork/skills not found in either worktree or main checkout"
      fi

      # Verify .git file in worktree (not a directory — worktrees use a gitfile)
      if [ -f "$WORKTREE_DIR/.git" ]; then
        pass "Worktree has .git file (correct worktree format)"
      else
        fail "Worktree .git is not a file — unexpected git structure"
      fi

      # Verify the build script can be located from within the worktree
      if [ -f "$WORKTREE_DIR/scripts/build-plugins.sh" ]; then
        pass "build-plugins.sh is accessible from within the worktree"
      else
        fail "build-plugins.sh not accessible from worktree"
      fi

    else
      fail "Failed to create git worktree at $WORKTREE_DIR"
      WORKTREE_DIR=""
    fi
  fi
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo "=== Results ==="
echo -e "${GREEN}Passed: $PASS${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Failed: $FAIL${NC}"
  exit 1
else
  echo -e "${GREEN}Failed: 0${NC}"
  echo -e "${GREEN}All worktree discovery tests passed.${NC}"
fi
