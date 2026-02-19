#!/usr/bin/env bash
# validate-counts.sh — Full count validation: counts from src/ vs CLAUDE.md and manifests
#
# Usage: ./scripts/validate-counts.sh [--help]
#
# Run from the repo root. Outputs a comparison table and exits non-zero if drift found.
# Requires: jq (brew install jq)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
DRIFT=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            echo "Usage: $0"
            echo "Validates hook, skill, and agent counts across CLAUDE.md, hooks.json, and manifests."
            echo "Exits 0 if all counts match, 1 if drift detected."
            exit 0 ;;
        *) echo "Unknown option: $1. Use --help." >&2; exit 2 ;;
    esac
done

if ! command -v jq &>/dev/null; then
    echo "Error: jq is required. Install with: brew install jq" >&2
    exit 1
fi

# =============================================================================
# ACTUAL COUNTS (authoritative — from src/)
# =============================================================================

ACTUAL_SKILLS=$(find "$REPO_ROOT/src/skills" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
ACTUAL_AGENTS=$(find "$REPO_ROOT/src/agents" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')
ACTUAL_HOOKS=$(jq '.hooks | length' "$REPO_ROOT/src/hooks/hooks.json")

# =============================================================================
# CLAUDE.md — extract counts from Project Overview and Version section
# =============================================================================

CLAUDE_MD="$REPO_ROOT/CLAUDE.md"

# Project Overview line: "63 skills, 37 agents, 87 hooks"
CLAUDE_OVERVIEW=$(grep -m1 'skills.*agents.*hooks' "$CLAUDE_MD" || true)
CLAUDE_OV_SKILLS=$(echo "$CLAUDE_OVERVIEW" | grep -oE '[0-9]+ skills?' | grep -oE '[0-9]+' || echo "?")
CLAUDE_OV_AGENTS=$(echo "$CLAUDE_OVERVIEW" | grep -oE '[0-9]+ agents?' | grep -oE '[0-9]+' || echo "?")
CLAUDE_OV_HOOKS=$(echo "$CLAUDE_OVERVIEW"  | grep -oE '[0-9]+ hooks?'  | grep -oE '[0-9]+' || echo "?")

# Version section: "N entries (X global + Y agent-scoped + Z skill-scoped"
CLAUDE_VER_HOOKS=$(grep -m1 'entries' "$CLAUDE_MD" | grep -oE '^[[:space:]]*\*\*Hooks\*\*:.*' | grep -oE '[0-9]+ entries' | grep -oE '[0-9]+' || \
                   grep -oE 'Hooks.*[0-9]+ entries' "$CLAUDE_MD" | grep -oE '[0-9]+' | head -1 || echo "?")

# =============================================================================
# MANIFESTS — count arrays
# =============================================================================

ORK_JSON="$REPO_ROOT/manifests/ork.json"
ORKL_JSON="$REPO_ROOT/manifests/orkl.json"

ORK_SKILLS=$(jq '[.skills // [] | length] | .[0]' "$ORK_JSON" 2>/dev/null || echo "?")
ORK_AGENTS=$(jq '[.agents // [] | length] | .[0]' "$ORK_JSON" 2>/dev/null || echo "?")
ORK_HOOKS=$(jq '[.hooks // [] | length] | .[0]'  "$ORK_JSON" 2>/dev/null || echo "?")

ORKL_SKILLS=$(jq '[.skills // [] | length] | .[0]' "$ORKL_JSON" 2>/dev/null || echo "?")
ORKL_AGENTS=$(jq '[.agents // [] | length] | .[0]' "$ORKL_JSON" 2>/dev/null || echo "?")
ORKL_HOOKS=$(jq '[.hooks // [] | length] | .[0]'   "$ORKL_JSON" 2>/dev/null || echo "?")

# =============================================================================
# COMPARISON HELPERS
# =============================================================================

status() {
    local actual="$1" derived="$2"
    if [[ "$derived" == "?" ]]; then
        echo "SKIP"
    elif [[ "$actual" == "$derived" ]]; then
        echo "MATCH"
    else
        echo "DRIFT"
        DRIFT=1
    fi
}

# =============================================================================
# OUTPUT TABLE
# =============================================================================

echo ""
echo "OrchestKit Count Validation"
echo "==========================="
printf "%-32s %7s %7s %7s %8s\n" "Source" "Skills" "Agents" "Hooks" "Status"
printf "%-32s %7s %7s %7s %8s\n" "------" "------" "------" "-----" "------"
printf "%-32s %7s %7s %7s %8s\n" "src/skills/ (actual)"          "$ACTUAL_SKILLS" "—"              "—"            "—"
printf "%-32s %7s %7s %7s %8s\n" "src/agents/ (actual)"          "—"              "$ACTUAL_AGENTS" "—"            "—"
printf "%-32s %7s %7s %7s %8s\n" "src/hooks/hooks.json (actual)" "—"              "—"              "$ACTUAL_HOOKS" "—"

OV_STATUS=$(status "$ACTUAL_SKILLS" "$CLAUDE_OV_SKILLS")
[[ "$ACTUAL_AGENTS" != "$CLAUDE_OV_AGENTS" ]] && { OV_STATUS="DRIFT"; DRIFT=1; }
[[ "$ACTUAL_HOOKS"  != "$CLAUDE_OV_HOOKS"  ]] && { OV_STATUS="DRIFT"; DRIFT=1; }
printf "%-32s %7s %7s %7s %8s\n" "CLAUDE.md Project Overview" "$CLAUDE_OV_SKILLS" "$CLAUDE_OV_AGENTS" "$CLAUDE_OV_HOOKS" "$OV_STATUS"

VER_STATUS=$(status "$ACTUAL_HOOKS" "$CLAUDE_VER_HOOKS")
printf "%-32s %7s %7s %7s %8s\n" "CLAUDE.md Version section" "—" "—" "$CLAUDE_VER_HOOKS" "$VER_STATUS"

ORK_S=$(status "$ACTUAL_SKILLS" "$ORK_SKILLS")
[[ "$ACTUAL_AGENTS" != "$ORK_AGENTS" ]] && { ORK_S="DRIFT"; DRIFT=1; }
[[ "$ACTUAL_HOOKS"  != "$ORK_HOOKS"  ]] && { ORK_S="DRIFT"; DRIFT=1; }
printf "%-32s %7s %7s %7s %8s\n" "manifests/ork.json" "$ORK_SKILLS" "$ORK_AGENTS" "$ORK_HOOKS" "$ORK_S"

# orkl skill count legitimately differs — only flag agents and hooks
ORKL_S="NOTE"
[[ "$ACTUAL_AGENTS" != "$ORKL_AGENTS" ]] && { ORKL_S="DRIFT"; DRIFT=1; }
[[ "$ACTUAL_HOOKS"  != "$ORKL_HOOKS"  ]] && { ORKL_S="DRIFT"; DRIFT=1; }
printf "%-32s %7s %7s %7s %8s\n" "manifests/orkl.json" "$ORKL_SKILLS" "$ORKL_AGENTS" "$ORKL_HOOKS" "$ORKL_S"

echo ""

# =============================================================================
# RESULT
# =============================================================================

if [[ $DRIFT -eq 0 ]]; then
    echo "All counts consistent."
    exit 0
else
    echo "DRIFT DETECTED — update the stale sources listed above."
    echo "  - CLAUDE.md Project Overview: skills, agents, hooks counts"
    echo "  - CLAUDE.md Version section: hooks entries count"
    echo "  - manifests/ork.json and manifests/orkl.json: after npm run build"
    exit 1
fi
