#!/usr/bin/env bash
# count-all.sh — Count OrchestKit hooks, skills, and agents from authoritative sources
#
# Usage: ./scripts/count-all.sh [--json]
#   --json    Output raw counts as JSON for scripting
#   --help    Show this help message
#
# Run from the repo root. Outputs a summary table of actual counts.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Argument parsing
JSON_OUTPUT=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --json) JSON_OUTPUT=true; shift ;;
        --help|-h)
            echo "Usage: $0 [--json]"
            echo "Count hooks, skills, and agents from authoritative sources."
            echo "Run from the repo root or any subdirectory."
            exit 0 ;;
        *) echo "Unknown option: $1. Use --help." >&2; exit 2 ;;
    esac
done

# --- Count skills ---
SKILLS_DIR="$REPO_ROOT/src/skills"
if [[ ! -d "$SKILLS_DIR" ]]; then
    echo "Error: src/skills/ not found at $REPO_ROOT" >&2
    exit 1
fi
SKILL_COUNT=$(find "$SKILLS_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')

# --- Count agents ---
AGENTS_DIR="$REPO_ROOT/src/agents"
if [[ ! -d "$AGENTS_DIR" ]]; then
    echo "Error: src/agents/ not found at $REPO_ROOT" >&2
    exit 1
fi
AGENT_COUNT=$(find "$AGENTS_DIR" -maxdepth 1 -name "*.md" | wc -l | tr -d ' ')

# --- Count hooks ---
HOOKS_JSON="$REPO_ROOT/src/hooks/hooks.json"
if [[ ! -f "$HOOKS_JSON" ]]; then
    echo "Error: src/hooks/hooks.json not found at $REPO_ROOT" >&2
    exit 1
fi
if ! command -v jq &>/dev/null; then
    echo "Error: jq is required. Install with: brew install jq" >&2
    exit 1
fi
HOOK_COUNT=$(jq '.hooks | length' "$HOOKS_JSON")

# --- Output ---
if $JSON_OUTPUT; then
    echo "{\"skills\": $SKILL_COUNT, \"agents\": $AGENT_COUNT, \"hooks\": $HOOK_COUNT}"
else
    echo "OrchestKit Actual Counts (from source)"
    echo "======================================="
    printf "  Skills  (src/skills/*/):            %s\n" "$SKILL_COUNT"
    printf "  Agents  (src/agents/*.md):           %s\n" "$AGENT_COUNT"
    printf "  Hooks   (src/hooks/hooks.json):      %s\n" "$HOOK_COUNT"
    echo ""
    echo "Compare these against CLAUDE.md and manifests/ to detect drift."
fi
