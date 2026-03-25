#!/bin/bash
# Scan docs MDX files for hardcoded TOTAL skill/agent/hook counts
# Only flags patterns like "98 skills" (total counts), not "7 skills in this category"
#
# Patterns matched (total count contexts):
#   - "N skills, N agents, N hooks" (triple count)
#   - "N skills" at start of sentence or after "all/total/our"
#   - Title/description fields with counts
#
# Exit codes:
#   0 - No stale total counts found
#   1 - Stale hardcoded total counts detected

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DOCS_DIR="$PROJECT_ROOT/docs/site/content"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get actual counts
ACTUAL_SKILLS=$(find "$PROJECT_ROOT/src/skills" -name "SKILL.md" -type f 2>/dev/null | wc -l | tr -d ' ')
ACTUAL_AGENTS=$(find "$PROJECT_ROOT/src/agents" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' ')
eval "$("$PROJECT_ROOT/bin/count-hooks.sh" 2>/dev/null)"
ACTUAL_HOOKS=${TOTAL:-106}

STALE=0

echo "  Scanning docs for stale total counts..."
echo "    Actual: $ACTUAL_SKILLS skills, $ACTUAL_AGENTS agents, $ACTUAL_HOOKS hooks"

# Pattern 1: Triple count "N skills, N agents, N hooks" or "N skills, N agents, and N hooks"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)
  rel_path=${file#"$DOCS_DIR/"}

  # Skip changelog
  [[ "$rel_path" == *"changelog"* ]] && continue

  # Extract the skills number from the triple pattern
  # Use awk to reliably extract multi-digit numbers before " skills"
  s_num=$(echo "$content" | awk '{for(i=1;i<=NF;i++) if($(i+1)=="skills," || $(i+1)=="skills") {gsub(/[^0-9]/,"",$i); if($i+0 > 0) print $i}}' | head -1)
  if [[ -n "$s_num" ]] && [[ "$s_num" != "$ACTUAL_SKILLS" ]]; then
    echo -e "  ${YELLOW}⚠${NC} $rel_path:$lineno — says '$s_num skills' in total-count context (actual: $ACTUAL_SKILLS)"
    STALE=$((STALE + 1))
  fi
done < <(grep -rn "[0-9]* skills, [0-9]* agents" "$DOCS_DIR" --include="*.mdx" 2>/dev/null || true)

# Pattern 2: "All N skills" or "N skills total" or "OrchestKit's N skills"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)
  rel_path=${file#"$DOCS_DIR/"}
  [[ "$rel_path" == *"changelog"* ]] && continue

  s_num=$(echo "$content" | sed -n "s/.*[Aa]ll \([0-9][0-9]*\) skills.*/\1/p" | head -1)
  [[ -z "$s_num" ]] && s_num=$(echo "$content" | sed -n "s/.*OrchestKit's \([0-9][0-9]*\) skills.*/\1/p" | head -1)

  if [[ -n "$s_num" ]] && [[ "$s_num" != "$ACTUAL_SKILLS" ]]; then
    echo -e "  ${YELLOW}⚠${NC} $rel_path:$lineno — says '$s_num skills' (actual: $ACTUAL_SKILLS)"
    STALE=$((STALE + 1))
  fi
done < <(grep -rn "ll [0-9]* skills\|OrchestKit's [0-9]* skills" "$DOCS_DIR" --include="*.mdx" 2>/dev/null || true)

# Pattern 3: "N total" counts like "98 total:" or "98 skills total"
while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  file=$(echo "$line" | cut -d: -f1)
  lineno=$(echo "$line" | cut -d: -f2)
  content=$(echo "$line" | cut -d: -f3-)
  rel_path=${file#"$DOCS_DIR/"}
  [[ "$rel_path" == *"changelog"* ]] && continue

  s_num=$(echo "$content" | sed -n 's/^\([0-9][0-9]*\) total.*/\1/p' | head -1)
  if [[ -n "$s_num" ]] && [[ "$s_num" != "$ACTUAL_SKILLS" ]] && [[ "$s_num" != "$ACTUAL_AGENTS" ]] && [[ "$s_num" != "$ACTUAL_HOOKS" ]]; then
    echo -e "  ${YELLOW}⚠${NC} $rel_path:$lineno — says '$s_num total' (actual: $ACTUAL_SKILLS/$ACTUAL_AGENTS/$ACTUAL_HOOKS)"
    STALE=$((STALE + 1))
  fi
done < <(grep -rn "^[0-9]* total" "$DOCS_DIR" --include="*.mdx" 2>/dev/null || true)

if [[ "$STALE" -gt 0 ]]; then
  echo ""
  echo -e "  ${RED}Found $STALE stale total-count reference(s) in docs${NC}"
  echo "  Fix: update hardcoded numbers to match actual counts"
  exit 1
fi

echo -e "  ${GREEN}✓${NC} All doc total counts match ($ACTUAL_SKILLS skills, $ACTUAL_AGENTS agents, $ACTUAL_HOOKS hooks)"
exit 0
