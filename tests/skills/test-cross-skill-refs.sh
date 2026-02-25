#!/usr/bin/env bash
# ============================================================================
# Cross-Skill Reference Validation
# ============================================================================
# Validates all cross-skill references point to existing skills.
#   A. Frontmatter skills: field in SKILL.md
#   B. Body ork:<name> references in SKILL.md
#   C. Agent skills: field in agent .md files
#
# Usage: ./test-cross-skill-refs.sh [--verbose]
# Exit codes: 0 = no broken refs, 1 = broken refs found
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
SKILLS_DIR="$PROJECT_ROOT/src/skills"
AGENTS_DIR="$PROJECT_ROOT/src/agents"
VERBOSE="${1:-}"
BROKEN=0; TOTAL_REFS=0; TOTAL_SKILLS=0

declare -A VALID_SKILLS REFERENCED_BY
for d in "$SKILLS_DIR"/*/; do
  [[ -d "$d" && -f "$d/SKILL.md" ]] || continue
  VALID_SKILLS["$(basename "$d")"]=1; TOTAL_SKILLS=$((TOTAL_SKILLS + 1))
done

log() { [[ "$VERBOSE" == "--verbose" ]] && echo "  INFO $1" || true; }

# Parse skills: array (inline [a,b] or multi-line - a) from YAML frontmatter
parse_skills_field() {
  local fm; fm=$(sed -n '/^---$/,/^---$/p' "$1" | sed '1d;$d')
  local skills_line; skills_line=$(echo "$fm" | grep -E '^skills:' || true)
  if [[ "$skills_line" =~ \[(.+)\] ]]; then
    echo "${BASH_REMATCH[1]}" | tr ',' '\n' | tr -d ' "'"'"''
  else
    local in=0
    while IFS= read -r line; do
      [[ "$line" == "skills:" ]] && { in=1; continue; }
      [[ $in -eq 1 && "$line" =~ ^[a-zA-Z] ]] && break
      [[ $in -eq 1 && "$line" =~ ^[[:space:]]*-[[:space:]]+(.*) ]] && echo "${BASH_REMATCH[1]}" | tr -d ' "'"'"''
    done <<< "$fm"
  fi
}

check_ref() { # $1=source $2=ref $3=label
  TOTAL_REFS=$((TOTAL_REFS + 1)); REFERENCED_BY["$2"]=1
  if [[ -z "${VALID_SKILLS[$2]:-}" ]]; then
    echo "  FAIL $1 references non-existent skill '$3'" ; BROKEN=$((BROKEN + 1))
  else log "$1 -> $2 (ok)"; fi
}

echo "============================================================================"
echo "  Cross-Skill Reference Validation"
echo "============================================================================"

# --- A. Frontmatter skills: field ----
echo -e "\nA. Frontmatter skills: field"
echo "────────────────────────────────────────────────────────────────────────────"
for f in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$f" ]] || continue; s=$(basename "$(dirname "$f")")
  while IFS= read -r ref; do
    [[ -n "$ref" ]] && check_ref "$s" "$ref" "$ref (frontmatter)"
  done < <(parse_skills_field "$f")
done

# --- B. Body ork:<name> references ---
echo -e "\nB. Body ork:<name> references"
echo "────────────────────────────────────────────────────────────────────────────"
for f in "$SKILLS_DIR"/*/SKILL.md; do
  [[ -f "$f" ]] || continue; s=$(basename "$(dirname "$f")")
  # Extract body, strip fenced code blocks to avoid false positives from ASCII art
  body=$(sed '1,/^---$/d' "$f" | sed '1,/^---$/d' | sed '/^```/,/^```/d')
  for ref in $(echo "$body" | grep -oE 'ork:[a-zA-Z][a-zA-Z0-9_-]*[a-zA-Z0-9]' | sed 's/^ork://' | sort -u); do
    [[ -n "$ref" && "$ref" != "$s" ]] && check_ref "$s" "$ref" "ork:$ref (body)"
  done
done

# --- C. Agent skills: field ----------
echo -e "\nC. Agent skills: field"
echo "────────────────────────────────────────────────────────────────────────────"
for f in "$AGENTS_DIR"/*.md; do
  [[ -f "$f" ]] || continue; a=$(basename "$f" .md)
  while IFS= read -r ref; do
    [[ -n "$ref" ]] && check_ref "agent $a" "$ref" "$ref (agent)"
  done < <(parse_skills_field "$f")
done

# --- Summary -------------------------
orphans=()
for skill in "${!VALID_SKILLS[@]}"; do
  [[ -z "${REFERENCED_BY[$skill]:-}" ]] && orphans+=("$skill")
done
IFS=$'\n' sorted_orphans=($(printf '%s\n' "${orphans[@]}" | sort)); unset IFS

echo ""
echo "============================================================================"
echo "  Reference Graph Summary"
echo "============================================================================"
echo "  Total skills:           $TOTAL_SKILLS"
echo "  Total cross-references: $TOTAL_REFS"
echo "  Broken references:      $BROKEN"
echo "  Orphan skills:          ${#sorted_orphans[@]}"
if [[ "$VERBOSE" == "--verbose" && ${#sorted_orphans[@]} -gt 0 ]]; then
  for o in "${sorted_orphans[@]}"; do echo "    - $o"; done
fi
echo "============================================================================"

if [[ $BROKEN -gt 0 ]]; then
  echo "FAILED: $BROKEN broken cross-skill reference(s) found"; exit 1
else
  echo "SUCCESS: All cross-skill references are valid"; exit 0
fi
