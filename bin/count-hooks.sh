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
#   GLOBAL=91 AGENT=22 SKILL=6 TOTAL=119
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
AGENT=0
for f in "$PROJECT_ROOT"/src/agents/*.md; do
  n=$(awk '/^---$/{if(++c==2) exit} /command:.*run-hook/{n++} END{print n+0}' "$f")
  AGENT=$((AGENT + n))
done

# Skill-scoped hooks: command:.*run-hook in YAML frontmatter
SKILL=0
while IFS= read -r f; do
  n=$(awk '/^---$/{if(++c==2) exit} /command:.*run-hook/{n++} END{print n+0}' "$f")
  SKILL=$((SKILL + n))
done < <(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null)

TOTAL=$((GLOBAL + AGENT + SKILL))

echo "GLOBAL=$GLOBAL AGENT=$AGENT SKILL=$SKILL TOTAL=$TOTAL"
