#!/usr/bin/env bash
# Test: Validates all skills have required SKILL.md (CC 2.1.7 flat structure)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_ROOT="$REPO_ROOT/src/skills"

FAILED=0
SKILL_COUNT=0

echo "=== Skill Structure Test (CC 2.1.7) ==="
echo ""

# CC 2.1.7 flat structure: src/skills/<skill-name>/SKILL.md
for skill_dir in "$SKILLS_ROOT"/*/; do
  if [[ ! -d "$skill_dir" ]]; then
    continue
  fi

  skill_name=$(basename "$skill_dir")
  SKILL_COUNT=$((SKILL_COUNT + 1))

  # SKILL.md is the only required file in CC 2.1.7
  if [[ ! -f "${skill_dir}SKILL.md" ]]; then
    echo "FAIL: $skill_name missing SKILL.md"
    FAILED=1
  else
    echo "PASS: $skill_name has SKILL.md"
  fi
done

echo ""
echo "Checked $SKILL_COUNT skills"
echo ""

if [[ $FAILED -eq 1 ]]; then
  echo "❌ Skill structure test FAILED"
  exit 1
else
  echo "✅ All skills have valid structure"
  exit 0
fi