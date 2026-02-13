#!/bin/bash
# =============================================================================
# Single source of truth for hook counting
# =============================================================================
# Counts hooks from:
#   1. hooks.json entries (global) — "type": "command" entries
#   2. Agent frontmatter — command:.*run-hook lines between --- markers
#   3. Skill frontmatter — command:.*run-hook lines between --- markers
#
# Output format (eval-friendly):
#   GLOBAL=93 AGENT=22 SKILL=6 TOTAL=121
#
# Usage:
#   eval "$(./bin/count-hooks.sh)"
#   echo "Total hooks: $TOTAL"
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Global hooks: count "type": "command" entries in hooks.json
GLOBAL=$(grep -c '"type": "command"' "$PROJECT_ROOT/src/hooks/hooks.json" 2>/dev/null || echo "0")

# Agent-scoped hooks: command:.*run-hook in YAML frontmatter
# Single grep across all files instead of per-file awk (96 forks → 2)
AGENT=$(grep -rch 'command:.*run-hook' "$PROJECT_ROOT/src/agents/" 2>/dev/null | awk '{s+=$1} END{print s+0}')

# Skill-scoped hooks: command:.*run-hook in YAML frontmatter
SKILL=$(grep -rch 'command:.*run-hook' "$PROJECT_ROOT/src/skills/" 2>/dev/null | awk '{s+=$1} END{print s+0}')

TOTAL=$((GLOBAL + AGENT + SKILL))

echo "GLOBAL=$GLOBAL AGENT=$AGENT SKILL=$SKILL TOTAL=$TOTAL"
