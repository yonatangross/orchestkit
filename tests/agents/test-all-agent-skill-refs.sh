#!/usr/bin/env bash
# Test: Validates ALL agents' skills: frontmatter references resolve to actual skill dirs
# Every skill listed in an agent's YAML frontmatter must have src/skills/<name>/SKILL.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"
SKILLS_DIR="$REPO_ROOT/src/skills"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

AGENTS_CHECKED=0
REFS_VALIDATED=0
BROKEN=0

echo "=== Agent Skill Reference Validation ==="
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)
  AGENTS_CHECKED=$((AGENTS_CHECKED + 1))

  # Extract YAML frontmatter between first and second --- delimiters
  frontmatter=$(awk '/^---$/{n++; next} n==1' "$agent_file")

  # Check if skills: field exists
  if ! echo "$frontmatter" | grep -q "^skills:"; then
    continue
  fi

  # Check for empty skills: [] on same line
  if echo "$frontmatter" | grep -q "^skills: *\[\]"; then
    continue
  fi

  # Extract skill names (lines starting with "  - " after "skills:")
  in_skills=0
  while IFS= read -r line; do
    if [[ "$line" =~ ^skills: ]]; then
      in_skills=1
      continue
    fi
    if [[ $in_skills -eq 1 ]]; then
      if [[ "$line" =~ ^[[:space:]]+- ]]; then
        skill=$(echo "$line" | sed 's/^[[:space:]]*- *//')
        REFS_VALIDATED=$((REFS_VALIDATED + 1))
        if [[ ! -f "$SKILLS_DIR/$skill/SKILL.md" ]]; then
          echo -e "${RED}FAIL${NC}: $agent_name references missing skill: $skill"
          BROKEN=$((BROKEN + 1))
        fi
      else
        in_skills=0
      fi
    fi
  done <<< "$frontmatter"
done

echo ""
echo "Summary: $AGENTS_CHECKED agents checked, $REFS_VALIDATED skill refs validated, $BROKEN broken"
echo ""

if [[ $BROKEN -gt 0 ]]; then
  echo -e "${RED}Agent skill reference validation FAILED ($BROKEN broken refs)${NC}"
  exit 1
else
  echo -e "${GREEN}All agent skill references resolve to valid skill directories${NC}"
  exit 0
fi
