#!/usr/bin/env bash
# ============================================================================
# github-operations Skill Completeness Test
# ============================================================================
# Validates the github-operations skill has all required components per issue #155.
#
# Required structure:
# skills/github-operations/
# ├── SKILL.md
# ├── references/
# │   ├── issue-management.md
# │   ├── pr-workflows.md
# │   ├── milestone-api.md
# │   ├── projects-v2.md
# │   └── graphql-api.md
# └── examples/
#     └── automation-scripts.md
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SKILL_DIR="$PROJECT_ROOT/src/skills/github-operations"

PASS=0
FAIL=0

# Colors
if [[ -t 1 ]]; then
    GREEN='\033[0;32m'
    RED='\033[0;31m'
    NC='\033[0m'
else
    GREEN='' RED='' NC=''
fi

pass() { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); }

echo "=== github-operations Completeness Test ==="
echo ""

# Test 1: SKILL.md exists
if [[ -f "$SKILL_DIR/SKILL.md" ]]; then
    pass "SKILL.md exists"
else
    fail "SKILL.md missing"
fi

# Test 2: Required references
REQUIRED_REFS=("issue-management.md" "pr-workflows.md" "milestone-api.md" "projects-v2.md" "graphql-api.md")
for ref in "${REQUIRED_REFS[@]}"; do
    if [[ -f "$SKILL_DIR/references/$ref" ]]; then
        pass "references/$ref exists"
    else
        fail "references/$ref missing"
    fi
done

# Test 3: Required examples
REQUIRED_EXAMPLES=("automation-scripts.md")
for example in "${REQUIRED_EXAMPLES[@]}"; do
    if [[ -f "$SKILL_DIR/examples/$example" ]]; then
        pass "examples/$example exists"
    else
        fail "examples/$example missing"
    fi
done

# Test 4: SKILL.md has required frontmatter fields
if grep -q "^name: github-operations" "$SKILL_DIR/SKILL.md"; then
    pass "SKILL.md has name field"
else
    fail "SKILL.md missing name field"
fi

if grep -q "^description:" "$SKILL_DIR/SKILL.md"; then
    pass "SKILL.md has description field"
else
    fail "SKILL.md missing description field"
fi

# Test 5: Examples have code blocks
if grep -q '```bash' "$SKILL_DIR/examples/automation-scripts.md"; then
    pass "automation-scripts.md has bash code blocks"
else
    fail "automation-scripts.md missing bash code blocks"
fi

# Test 6: Internal links are valid
echo ""
echo "Checking internal links..."
BROKEN_LINKS=0
while IFS= read -r link; do
    REL_PATH=$(echo "$link" | sed 's/.*(\(.*\))/\1/' | sed 's/#.*//')
    if [[ -n "$REL_PATH" && "$REL_PATH" != http* ]]; then
        FULL_PATH="$SKILL_DIR/$REL_PATH"
        if [[ ! -f "$FULL_PATH" ]]; then
            fail "Broken link: $REL_PATH"
            BROKEN_LINKS=$((BROKEN_LINKS + 1))
        fi
    fi
done < <(grep -oE '\[.*\]\([^)]+\)' "$SKILL_DIR/SKILL.md" 2>/dev/null || true)

if [[ $BROKEN_LINKS -eq 0 ]]; then
    pass "All internal links valid"
fi

# Summary
echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [[ $FAIL -gt 0 ]]; then
    exit 1
fi
exit 0
