#!/usr/bin/env bash
# Test: Validates all skills have required files (Tier 1-4)
# Each skill must have capabilities.json (Tier 1) and SKILL.md (Tier 2)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SKILLS_ROOT="$REPO_ROOT/skills"

FAILED=0
SKILL_COUNT=0

echo "=== Skill Structure Test ==="
echo ""

# Find all skill directories using CC 2.1.6 nested structure
for skill_dir in "$SKILLS_ROOT"/*/*/; do
  if [[ ! -d "$skill_dir" ]]; then
    continue
  fi

  skill_name=$(basename "$skill_dir")
  SKILL_COUNT=$((SKILL_COUNT + 1))
  skill_failed=0

  # Tier 1: capabilities.json (REQUIRED)
  if [[ ! -f "${skill_dir}capabilities.json" ]]; then
    echo "FAIL: $skill_name missing capabilities.json (Tier 1)"
    skill_failed=1
    FAILED=1
  fi

  # Tier 2: SKILL.md (REQUIRED)
  if [[ ! -f "${skill_dir}SKILL.md" ]]; then
    echo "FAIL: $skill_name missing SKILL.md (Tier 2)"
    skill_failed=1
    FAILED=1
  fi

  if [[ $skill_failed -eq 0 ]]; then
    echo "PASS: $skill_name has valid structure"
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