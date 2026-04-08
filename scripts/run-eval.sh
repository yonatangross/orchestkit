#!/usr/bin/env bash
# OrchestKit Eval Script — wraps claude -p --bare for skill evaluation
# Usage: scripts/run-eval.sh [--scope full|skills-only|hooks-only|changed]

set -euo pipefail

SCOPE="${1:---scope}"
SCOPE_VALUE="${2:-full}"
RESULTS_FILE="eval-results-skills.json"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --scope) SCOPE_VALUE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

echo "=== OrchestKit Eval Pipeline ==="
echo "Scope: ${SCOPE_VALUE}"
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Check for claude CLI
if ! command -v claude &> /dev/null; then
  echo "WARN: Claude Code CLI not found — running deterministic eval only"
  CLAUDE_AVAILABLE=false
else
  CLAUDE_AVAILABLE=true
  echo "Claude Code CLI: $(claude --version 2>/dev/null || echo 'unknown')"
fi

# Deterministic trigger detection eval (no LLM needed)
echo ""
echo "=== Phase 1: Trigger Detection Eval ==="

# Find all invocable skills with triggers
SKILL_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

for skill_dir in src/skills/*/; do
  skill_file="${skill_dir}SKILL.md"
  [ -f "$skill_file" ] || continue

  # Check if user-invocable
  if ! grep -q "^user-invocable: true" "$skill_file" 2>/dev/null; then
    continue
  fi

  skill_name=$(grep "^name:" "$skill_file" | head -1 | sed 's/^name: *//')
  SKILL_COUNT=$((SKILL_COUNT + 1))

  # Check for triggers frontmatter
  if grep -q "^triggers:" "$skill_file" 2>/dev/null; then
    PASS_COUNT=$((PASS_COUNT + 1))
    echo "  ✓ ${skill_name} — has triggers"
  else
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "  ✗ ${skill_name} — MISSING triggers frontmatter"
  fi
done

echo ""
echo "Trigger detection: ${PASS_COUNT}/${SKILL_COUNT} skills have triggers (${FAIL_COUNT} missing)"

# Skill structure validation
echo ""
echo "=== Phase 2: Skill Structure Validation ==="

STRUCT_PASS=0
STRUCT_FAIL=0

for skill_dir in src/skills/*/; do
  skill_file="${skill_dir}SKILL.md"
  [ -f "$skill_file" ] || continue

  skill_name=$(grep "^name:" "$skill_file" | head -1 | sed 's/^name: *//')
  errors=""

  # Check required frontmatter
  for field in name description version tags; do
    if ! grep -q "^${field}:" "$skill_file" 2>/dev/null; then
      errors="${errors}missing ${field}, "
    fi
  done

  # Check line count
  line_count=$(wc -l < "$skill_file")
  if [ "$line_count" -gt 500 ]; then
    errors="${errors}${line_count} lines (max 500), "
  fi

  if [ -z "$errors" ]; then
    STRUCT_PASS=$((STRUCT_PASS + 1))
  else
    STRUCT_FAIL=$((STRUCT_FAIL + 1))
    echo "  ✗ ${skill_name} — ${errors%%, }"
  fi
done

echo "Structure: ${STRUCT_PASS} pass, ${STRUCT_FAIL} fail"

# Quality eval with Claude (if available)
if [ "$CLAUDE_AVAILABLE" = true ] && [ "$SCOPE_VALUE" != "hooks-only" ]; then
  echo ""
  echo "=== Phase 3: LLM Quality Eval (claude -p --bare) ==="
  echo "Evaluating skill descriptions for clarity and trigger accuracy..."

  # Sample 5 skills for quality check (to stay within budget)
  SAMPLE_SKILLS=$(find src/skills -name "SKILL.md" -path "*/SKILL.md" | sort -R | head -5)

  for skill_file in $SAMPLE_SKILLS; do
    skill_name=$(grep "^name:" "$skill_file" | head -1 | sed 's/^name: *//')
    description=$(grep "^description:" "$skill_file" | head -1 | sed 's/^description: *//')

    echo "  Evaluating: ${skill_name}..."

    # Use --bare mode for fast, isolated eval
    EVAL_RESULT=$(claude -p --bare "Rate this AI skill description 1-10 for clarity and specificity. Reply with ONLY a number 1-10 and one sentence why. Description: '${description}'" 2>/dev/null || echo "N/A")

    echo "    Score: ${EVAL_RESULT}"
  done
fi

# Summary
echo ""
echo "=== Eval Summary ==="
echo "Skills evaluated: ${SKILL_COUNT}"
echo "Trigger coverage: ${PASS_COUNT}/${SKILL_COUNT}"
echo "Structure pass: ${STRUCT_PASS}"
echo "Structure fail: ${STRUCT_FAIL}"
echo "Scope: ${SCOPE_VALUE}"
echo "Done."
