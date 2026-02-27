#!/usr/bin/env bash
# validate-counts.sh — Full count validation: counts from src/ vs CLAUDE.md and manifests
#
# Usage: ./scripts/validate-counts.sh [--help]
#
# Run from the repo root. Outputs a comparison table and exits non-zero if drift found.
# Requires: jq (brew install jq)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
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
# hooks.json .hooks is an object keyed by event type → array of entries → each has .hooks array of commands
# Count = total commands across all entries across all event types
ACTUAL_HOOKS=$(jq '[.hooks | to_entries[] | .value[] | .hooks | length] | add' "$REPO_ROOT/src/hooks/hooks.json")

# =============================================================================
# CLAUDE.md — extract counts from Project Overview and Version section
# =============================================================================

CLAUDE_MD="$REPO_ROOT/CLAUDE.md"

# Project Overview line: "69 skills, 38 agents, 78 hooks"
CLAUDE_OVERVIEW=$(grep -m1 'skills.*agents.*hooks' "$CLAUDE_MD" || true)
CLAUDE_OV_SKILLS=$(echo "$CLAUDE_OVERVIEW" | grep -oE '[0-9]+ skills?' | grep -oE '[0-9]+' || echo "?")
CLAUDE_OV_AGENTS=$(echo "$CLAUDE_OVERVIEW" | grep -oE '[0-9]+ agents?' | grep -oE '[0-9]+' || echo "?")
CLAUDE_OV_HOOKS=$(echo "$CLAUDE_OVERVIEW"  | grep -oE '[0-9]+ hooks?'  | grep -oE '[0-9]+' || echo "?")

# Version section: "Hooks: 64 entries (...)"
CLAUDE_VER_LINE=$(grep -m1 'Hooks.*entries' "$CLAUDE_MD" || true)
if [[ -n "$CLAUDE_VER_LINE" ]]; then
    CLAUDE_VER_HOOKS=$(echo "$CLAUDE_VER_LINE" | grep -oE '[0-9]+ entries' | grep -oE '[0-9]+' || echo "?")
else
    CLAUDE_VER_HOOKS="?"
fi

# =============================================================================
# MANIFESTS — handle both "all" shorthand and explicit arrays
# =============================================================================

ORK_JSON="$REPO_ROOT/manifests/ork.json"

# Helper: if value is "all", return "all"; if array, return length; else "?"
manifest_count() {
    local file="$1" field="$2"
    local val
    val=$(jq -r ".$field | type" "$file" 2>/dev/null) || { echo "?"; return; }
    case "$val" in
        string)
            local str
            str=$(jq -r ".$field" "$file")
            if [[ "$str" == "all" ]]; then echo "all"; else echo "?"; fi ;;
        array)  jq ".$field | length" "$file" ;;
        *)      echo "?" ;;
    esac
}

ORK_SKILLS=$(manifest_count "$ORK_JSON" skills)
ORK_AGENTS=$(manifest_count "$ORK_JSON" agents)
ORK_HOOKS=$(manifest_count "$ORK_JSON" hooks)


# =============================================================================
# COMPARISON HELPERS
# =============================================================================

status() {
    local actual="$1" derived="$2"
    if [[ "$derived" == "?" ]]; then
        echo "SKIP"
    elif [[ "$derived" == "all" ]]; then
        echo "MATCH"  # "all" means it includes everything from src/
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
[[ $(status "$ACTUAL_AGENTS" "$CLAUDE_OV_AGENTS") == "DRIFT" ]] && { OV_STATUS="DRIFT"; DRIFT=1; }
[[ $(status "$ACTUAL_HOOKS"  "$CLAUDE_OV_HOOKS")  == "DRIFT" ]] && { OV_STATUS="DRIFT"; DRIFT=1; }
printf "%-32s %7s %7s %7s %8s\n" "CLAUDE.md Project Overview" "$CLAUDE_OV_SKILLS" "$CLAUDE_OV_AGENTS" "$CLAUDE_OV_HOOKS" "$OV_STATUS"

VER_STATUS=$(status "$ACTUAL_HOOKS" "$CLAUDE_VER_HOOKS")
printf "%-32s %7s %7s %7s %8s\n" "CLAUDE.md Version section" "—" "—" "$CLAUDE_VER_HOOKS" "$VER_STATUS"

ORK_S="MATCH"
[[ $(status "$ACTUAL_SKILLS" "$ORK_SKILLS") == "DRIFT" ]] && { ORK_S="DRIFT"; DRIFT=1; }
[[ $(status "$ACTUAL_AGENTS" "$ORK_AGENTS") == "DRIFT" ]] && { ORK_S="DRIFT"; DRIFT=1; }
[[ $(status "$ACTUAL_HOOKS"  "$ORK_HOOKS")  == "DRIFT" ]] && { ORK_S="DRIFT"; DRIFT=1; }
printf "%-32s %7s %7s %7s %8s\n" "manifests/ork.json" "$ORK_SKILLS" "$ORK_AGENTS" "$ORK_HOOKS" "$ORK_S"

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
    echo "  - manifests/ork.json: after npm run build"
    exit 1
fi
