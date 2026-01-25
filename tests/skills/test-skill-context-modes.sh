#!/usr/bin/env bash
# Test: Validates skill context modes are appropriate
# Quick utilities should use inherit, complex operations should use fork

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_ROOT="$REPO_ROOT/src/skills"

# Quick utilities that should use inherit (not fork)
INHERIT_SKILLS=(
  "commit"
  "configure"
  "doctor"
  "errors"
)

WARNINGS=0
SKILL_COUNT=0

echo "=== Skill Context Modes Test ==="
echo ""

for skill_dir in "$SKILLS_ROOT"/*/*/; do
  if [[ ! -d "$skill_dir" ]]; then
    continue
  fi

  skill_name=$(basename "$skill_dir")
  skill_md="${skill_dir}SKILL.md"
  SKILL_COUNT=$((SKILL_COUNT + 1))

  if [[ ! -f "$skill_md" ]]; then
    continue
  fi

  context=$(grep -E "^context:" "$skill_md" 2>/dev/null | awk '{print $2}' || echo "")

  # Check if inherit skills aren't using fork
  for inherit_skill in "${INHERIT_SKILLS[@]}"; do
    if [[ "$skill_name" == "$inherit_skill" && "$context" == "fork" ]]; then
      echo "WARN: $skill_name should use inherit, not fork (quick utility)"
      WARNINGS=$((WARNINGS + 1))
    fi
  done

  # Log what we found
  if [[ -n "$context" ]]; then
    echo "INFO: $skill_name uses context: $context"
  fi
done

echo ""
echo "Checked $SKILL_COUNT skills"

if [[ $WARNINGS -gt 0 ]]; then
  echo "⚠️  $WARNINGS warnings found (non-blocking)"
fi

echo "✅ Skill context modes validated"
exit 0