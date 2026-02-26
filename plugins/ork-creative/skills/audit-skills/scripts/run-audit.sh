#!/usr/bin/env bash
# run-audit.sh — Audit OrchestKit skills for quality and compliance
# Usage: scripts/run-audit.sh [--fail-fast]
# Requires: jq
# Run from the repo root.

set -euo pipefail

FAIL_FAST=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fail-fast) FAIL_FAST=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--fail-fast]"
      echo "Audits all src/skills/*/SKILL.md for quality and compliance."
      exit 0 ;;
    *) echo "Unknown option: $1. Use --help." >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
SKILLS_DIR="$REPO_ROOT/src/skills"
ORK_MANIFEST="$REPO_ROOT/manifests/ork.json"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Error: src/skills/ not found at $REPO_ROOT" >&2; exit 1
fi

# Check if ork.json uses "all" shorthand
ORK_SKILLS_VAL=$(jq -r '.skills' "$ORK_MANIFEST" 2>/dev/null || echo "")
ORK_ALL=false
[[ "$ORK_SKILLS_VAL" == "all" ]] && ORK_ALL=true

PASS=0; WARN=0; FAIL=0

printf "%-40s %5s %4s %5s %4s %4s %s\n" "Skill" "Lines" "FM" "Rules" "Refs" "Mfst" "Status"
printf -- '-%.0s' {1..75}; echo

for SKILL_MD in "$SKILLS_DIR"/*/SKILL.md; do
  SKILL_DIR=$(dirname "$SKILL_MD")
  SKILL_NAME=$(basename "$SKILL_DIR")
  STATUS="PASS"
  WARNINGS=()
  FAILS=()

  # Check 1: line count
  LINE_COUNT=$(wc -l < "$SKILL_MD" | tr -d ' ')
  if (( LINE_COUNT > 500 )); then
    FAILS+=("FAIL: skill_md_too_long:${LINE_COUNT}_lines")
    STATUS="FAIL"
  elif (( LINE_COUNT > 400 )); then
    WARNINGS+=("WARN: approaching_500_line_limit:${LINE_COUNT}_lines")
    [[ "$STATUS" == "PASS" ]] && STATUS="WARN"
  fi

  # Check 2: required frontmatter
  FM_ISSUES=()
  for FIELD in name description tags version author user-invocable complexity; do
    grep -q "^${FIELD}:" "$SKILL_MD" || FM_ISSUES+=("$FIELD")
  done
  FM_STATUS="OK"
  if (( ${#FM_ISSUES[@]} > 0 )); then
    FM_STATUS="WARN"
    WARNINGS+=("WARN: missing_fm:$(IFS=,; echo "${FM_ISSUES[*]}")")
    [[ "$STATUS" == "PASS" ]] && STATUS="WARN"
  fi

  # Check 3 & 4: rules and refs count
  RULES_COUNT=$(find "$SKILL_DIR/rules" -name "*.md" 2>/dev/null | grep -v '/[_]' | wc -l | tr -d ' ')
  REFS_COUNT=$(find "$SKILL_DIR/references" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

  # Check 5: no supporting files
  if (( RULES_COUNT == 0 && REFS_COUNT == 0 )); then
    WARNINGS+=("WARN: no_rules_or_refs")
    [[ "$STATUS" == "PASS" ]] && STATUS="WARN"
  fi

  # Check 6: manifest registration
  MFST="YES"
  if ! $ORK_ALL; then
    IN_ORK=$(jq -r --arg n "$SKILL_NAME" '.skills | if type=="array" then (map(if type=="object" then .name else . end) | index($n)) != null else false end' "$ORK_MANIFEST" 2>/dev/null || echo "false")
    [[ "$IN_ORK" != "true" ]] && MFST="NO"
  fi
  if [[ "$MFST" == "NO" ]]; then
    FAILS+=("FAIL: not_in_manifest")
    STATUS="FAIL"
  fi

  printf "%-40s %5s %4s %5s %4s %4s %s\n" \
    "$SKILL_NAME" "$LINE_COUNT" "$FM_STATUS" "$RULES_COUNT" "$REFS_COUNT" "$MFST" "$STATUS"

  for W in "${WARNINGS[@]}"; do printf "  %s\n" "$W"; done
  for F in "${FAILS[@]}"; do printf "  %s\n" "$F"; done

  case "$STATUS" in
    PASS) ((PASS++)) ;;
    WARN) ((WARN++)) ;;
    FAIL) ((FAIL++)); $FAIL_FAST && { echo "Stopped at first FAIL (--fail-fast)"; exit 1; } ;;
  esac
done

printf -- '-%.0s' {1..75}; echo
echo "Total: $((PASS+WARN+FAIL)) skills | PASS: $PASS | WARN: $WARN | FAIL: $FAIL"
(( FAIL > 0 )) && exit 1 || exit 0
