#!/usr/bin/env bash
# Test: Validates all skill references in agents exist
# Agents reference skills in frontmatter, those skills must exist

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
AGENTS_DIR="$REPO_ROOT/src/agents"
SKILLS_ROOT="$REPO_ROOT/src/skills"

FAILED=0
CHECKED=0

echo "=== Skill References Test ==="
echo ""

for agent_file in "$AGENTS_DIR"/*.md; do
  agent_name=$(basename "$agent_file" .md)

  # Extract skills from frontmatter (between --- delimiters)
  # Look for lines starting with "  - " after "skills:"
  in_skills=0
  while IFS= read -r line; do
    # Check for end of frontmatter
    if [[ "$line" == "---" && $in_skills -eq 1 ]]; then
      break
    fi

    # Check for skills: section
    if [[ "$line" == "skills:" ]]; then
      in_skills=1
      continue
    fi

    # Check for new section (non-indented line with colon)
    if [[ $in_skills -eq 1 && "$line" =~ ^[a-zA-Z] ]]; then
      in_skills=0
      continue
    fi

    # Extract skill name
    if [[ $in_skills -eq 1 && "$line" =~ ^[[:space:]]*-[[:space:]]+(.*) ]]; then
      skill="${BASH_REMATCH[1]}"
      CHECKED=$((CHECKED + 1))

      # Search for skill in nested structure
      found=$(find "$SKILLS_ROOT" -path "*/$skill" -type d 2>/dev/null | head -1)

      if [[ -z "$found" ]]; then
        echo "FAIL: $agent_name references non-existent skill: $skill"
        FAILED=1
      else
        echo "PASS: $agent_name -> $skill (found)"
      fi
    fi
  done < "$agent_file"
done

echo ""
echo "Checked $CHECKED skill references"
echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ Skill references test FAILED"
  exit 1
else
  echo "✅ All agent skill references are valid"
  exit 0
fi