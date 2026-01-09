#!/usr/bin/env bash
# ============================================================================
# Token Budget Validation Script
# ============================================================================
# Validates that all capabilities.json files are within token budget limits.
# Designed for CI integration - exits with non-zero if limits exceeded.
#
# Usage:
#   ./bin/validate-token-budget.sh           # Validate all, fail on violations
#   ./bin/validate-token-budget.sh --warn    # Validate all, warn only
#   ./bin/validate-token-budget.sh --report  # Generate detailed report
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/.claude/skills"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Token limits
TIER1_LIMIT=350      # Strict limit for Tier 1 (capabilities.json)
TIER1_RECOMMENDED=200  # Recommended target

WARN_ONLY=false
REPORT_MODE=false

for arg in "$@"; do
    case $arg in
        --warn) WARN_ONLY=true ;;
        --report) REPORT_MODE=true ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --warn     Warn only, don't fail on violations"
            echo "  --report   Generate detailed report"
            echo "  --help     Show this help"
            exit 0
            ;;
    esac
done

# Token counting (chars/4 approximation)
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

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${BLUE}ℹ${NC} $1"; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Token Budget Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Tier 1 (capabilities.json) Limits:"
echo "  - Strict limit: <${TIER1_LIMIT} tokens"
echo "  - Recommended: <${TIER1_RECOMMENDED} tokens"
echo ""

total_tokens=0
skill_count=0
violations=0
warnings=0
max_tokens=0
max_skill=""

# Collect data for all skills
declare -a skill_data

for skill_dir in "$SKILLS_DIR"/*; do
    if [[ -d "$skill_dir" ]] && [[ -f "$skill_dir/capabilities.json" ]]; then
        skill_name=$(basename "$skill_dir")
        tokens=$(count_tokens "$skill_dir/capabilities.json")
        total_tokens=$((total_tokens + tokens))
        ((skill_count++)) || true

        if [[ "$tokens" -gt "$max_tokens" ]]; then
            max_tokens=$tokens
            max_skill=$skill_name
        fi

        skill_data+=("$skill_name:$tokens")

        if [[ "$tokens" -gt "$TIER1_LIMIT" ]]; then
            fail "$skill_name: $tokens tokens (EXCEEDS LIMIT: $TIER1_LIMIT)"
            ((violations++)) || true
        elif [[ "$tokens" -gt "$TIER1_RECOMMENDED" ]]; then
            if [[ "$REPORT_MODE" == "true" ]]; then
                warn "$skill_name: $tokens tokens (above recommended: $TIER1_RECOMMENDED)"
            fi
            ((warnings++)) || true
        else
            if [[ "$REPORT_MODE" == "true" ]]; then
                pass "$skill_name: $tokens tokens"
            fi
        fi
    fi
done

echo ""

# Summary
avg_tokens=0
if [[ $skill_count -gt 0 ]]; then
    avg_tokens=$((total_tokens / skill_count))
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Skills validated:    $skill_count"
echo "  Total Tier 1 tokens: $total_tokens"
echo "  Average tokens:      $avg_tokens"
echo "  Maximum tokens:      $max_tokens ($max_skill)"
echo ""
echo "  Violations (>$TIER1_LIMIT):  $violations"
echo "  Warnings (>$TIER1_RECOMMENDED):   $warnings"
echo "  Compliant:           $((skill_count - violations - warnings))"
echo ""

# Calculate savings from migration
# Original average was 762 tokens
original_avg=762
if [[ $avg_tokens -gt 0 ]]; then
    savings_pct=$(( (original_avg - avg_tokens) * 100 / original_avg ))
    info "Token reduction from migration: ${savings_pct}% (${original_avg} → ${avg_tokens} avg)"
fi

echo ""

if [[ $violations -gt 0 ]]; then
    if [[ "$WARN_ONLY" == "true" ]]; then
        warn "$violations skill(s) exceed token limit (warning only)"
        exit 0
    else
        fail "$violations skill(s) exceed token limit"
        exit 1
    fi
else
    if [[ $warnings -gt 0 ]]; then
        pass "All skills within strict limit ($warnings above recommended)"
    else
        pass "All skills within recommended budget"
    fi
    exit 0
fi