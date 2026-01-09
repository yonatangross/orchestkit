#!/usr/bin/env bash
# ============================================================================
# Static Analysis / Lint Suite
# ============================================================================
# Runs all static analysis checks:
# - JSON validity and schema validation
# - Shell script linting (shellcheck)
# - Structure validation (Tier 1-4 completeness)
# - Cross-reference validation (agent → skill refs)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; ((PASS_COUNT++)) || true; }
fail() { echo -e "  ${RED}✗${NC} $1"; ((FAIL_COUNT++)) || true; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; ((WARN_COUNT++)) || true; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Static Analysis Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# 1. JSON Validity
# ============================================================================
echo "▶ JSON Validity"
echo "────────────────────────────────────────"

json_errors=0
while IFS= read -r -d '' file; do
    if ! jq empty "$file" 2>/dev/null; then
        fail "Invalid JSON: $file"
        ((json_errors++)) || true
    fi
done < <(find "$PROJECT_ROOT/.claude" -name "*.json" -print0 2>/dev/null)

# Check plugin.json separately
if [ -f "$PROJECT_ROOT/plugin.json" ]; then
    if jq empty "$PROJECT_ROOT/plugin.json" 2>/dev/null; then
        pass "plugin.json is valid JSON"
    else
        fail "plugin.json is invalid JSON"
        ((json_errors++)) || true
    fi
fi

if [ "$json_errors" -eq 0 ]; then
    pass "All JSON files are valid"
else
    fail "$json_errors JSON files have errors"
fi

echo ""

# ============================================================================
# 2. Shell Script Linting (shellcheck)
# ============================================================================
echo "▶ Shell Script Linting"
echo "────────────────────────────────────────"

if command -v shellcheck &>/dev/null; then
    shell_errors=0
    shell_warnings=0

    while IFS= read -r -d '' file; do
        # Run shellcheck with specific exclusions for our patterns
        result=$(shellcheck -f gcc -e SC1090,SC1091,SC2034,SC2155 "$file" 2>&1 || true)

        if echo "$result" | grep -q ":error:"; then
            fail "Shellcheck errors in: $(basename "$file")"
            ((shell_errors++)) || true
        elif echo "$result" | grep -q ":warning:"; then
            # Warnings are acceptable but noted
            ((shell_warnings++)) || true
        fi
    done < <(find "$PROJECT_ROOT/.claude/hooks" -name "*.sh" -print0 2>/dev/null)

    if [ "$shell_errors" -eq 0 ]; then
        pass "All shell scripts pass shellcheck"
        if [ "$shell_warnings" -gt 0 ]; then
            info "$shell_warnings warnings (non-blocking)"
        fi
    else
        fail "$shell_errors shell scripts have errors"
    fi
else
    warn "shellcheck not installed, skipping shell lint"
fi

echo ""

# ============================================================================
# 3. Schema Validation
# ============================================================================
echo "▶ Schema Validation"
echo "────────────────────────────────────────"

# Check all capabilities.json have $schema
caps_with_schema=0
caps_without_schema=0

while IFS= read -r -d '' file; do
    if jq -e '."$schema"' "$file" >/dev/null 2>&1; then
        ((caps_with_schema++)) || true
    else
        fail "Missing \$schema: $file"
        ((caps_without_schema++)) || true
    fi
done < <(find "$PROJECT_ROOT/.claude/skills" -name "capabilities.json" -print0 2>/dev/null)

if [ "$caps_without_schema" -eq 0 ]; then
    pass "All $caps_with_schema capabilities.json files have \$schema"
else
    fail "$caps_without_schema capabilities.json files missing \$schema"
fi

echo ""

# ============================================================================
# 4. Structure Validation (Tier 1-4 Completeness)
# ============================================================================
echo "▶ Skill Structure Validation"
echo "────────────────────────────────────────"

incomplete_skills=0
complete_skills=0

for skill_dir in "$PROJECT_ROOT/.claude/skills"/*; do
    if [ -d "$skill_dir" ]; then
        skill_name=$(basename "$skill_dir")
        has_tier1=false
        has_tier2=false

        # Tier 1: capabilities.json (required)
        [ -f "$skill_dir/capabilities.json" ] && has_tier1=true

        # Tier 2: SKILL.md (required)
        [ -f "$skill_dir/SKILL.md" ] && has_tier2=true

        if $has_tier1 && $has_tier2; then
            ((complete_skills++)) || true
        else
            missing=""
            $has_tier1 || missing+="capabilities.json "
            $has_tier2 || missing+="SKILL.md "
            fail "$skill_name missing: $missing"
            ((incomplete_skills++)) || true
        fi
    fi
done

if [ "$incomplete_skills" -eq 0 ]; then
    pass "All $complete_skills skills have required Tier 1-2 files"
else
    fail "$incomplete_skills skills have incomplete structure"
fi

echo ""

# ============================================================================
# 5. Cross-Reference Validation
# ============================================================================
echo "▶ Cross-Reference Validation"
echo "────────────────────────────────────────"

crossref_errors=0

# Check that agent skills_used references exist
if [ -f "$PROJECT_ROOT/plugin.json" ]; then
    # Get all skill IDs from plugin.json
    skill_ids=$(jq -r '.skills[]?.id // empty' "$PROJECT_ROOT/plugin.json" 2>/dev/null | sort -u)

    # Get all agent skills_used
    agent_skills=$(jq -r '.agents[]?.skills_used[]? // empty' "$PROJECT_ROOT/plugin.json" 2>/dev/null | sort -u)

    for skill in $agent_skills; do
        if ! echo "$skill_ids" | grep -qx "$skill"; then
            fail "Agent references non-existent skill: $skill"
            ((crossref_errors++)) || true
        fi
    done

    if [ "$crossref_errors" -eq 0 ]; then
        pass "All agent skill references are valid"
    fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS_COUNT passed, $FAIL_COUNT failed, $WARN_COUNT warnings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

exit 0