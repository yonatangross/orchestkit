#!/usr/bin/env bash
# ============================================================================
# Eval Coverage Walker — OrchestKit (#2192)
# ============================================================================
# Walks every shipped component (skills + agents) and diffs it against the
# committed eval specs, so a new component without a spec is caught instead of
# silently uncovered.
#
#   skills : src/skills/*/SKILL.md      vs  tests/evals/skills/*.eval.yaml
#   agents : src/agents/*.md            vs  tests/evals/agents/*.eval.yaml
#
# Enumeration mirrors scripts/eval/static-analysis.sh (SKILL.md presence for
# skills, top-level *.md for agents), so src/skills/shared/ and src/agents/shared/
# are naturally excluded (no SKILL.md / not top-level) and never counted.
#
# Usage:
#   bash scripts/eval/eval-coverage.sh              # report + write coverage.json
#   bash scripts/eval/eval-coverage.sh --json-only  # write coverage.json, no table
#   bash scripts/eval/eval-coverage.sh --fill       # generate starter specs for gaps
#   bash scripts/eval/eval-coverage.sh --check      # exit 1 if any component uncovered
#
# --check is the ratchet used by CI (tests/evals/test-eval-coverage.sh). Default
# mode always exits 0 so it can be called additively from static-analysis.sh.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

SKILLS_DIR="$PROJECT_ROOT/src/skills"
AGENTS_DIR="$PROJECT_ROOT/src/agents"
SKILL_SPECS_DIR="$PROJECT_ROOT/tests/evals/skills"
AGENT_SPECS_DIR="$PROJECT_ROOT/tests/evals/agents"
RESULTS_DIR="$PROJECT_ROOT/tests/evals/results"
COVERAGE_FILE="$RESULTS_DIR/coverage.json"
GEN_HELPER="$SCRIPT_DIR/lib/gen-starter-spec.py"

MODE="report"   # report | json-only | fill | check
case "${1:-}" in
  --json-only) MODE="json-only" ;;
  --fill) MODE="fill" ;;
  --check) MODE="check" ;;
  "") MODE="report" ;;
  *) echo "Unknown flag: $1" >&2; exit 2 ;;
esac

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

# ── Enumerate components and specs (each helper emits a sorted, unique list) ──
list_skills() {
  for d in "$SKILLS_DIR"/*/SKILL.md; do
    [ -f "$d" ] && basename "$(dirname "$d")"
  done | sort -u
}
list_agents() {
  # A component agent is a top-level *.md carrying YAML frontmatter. This drops
  # src/agents/README.md and any stray docs (37 real agents, per CLAUDE.md).
  for f in "$AGENTS_DIR"/*.md; do
    [ -f "$f" ] || continue
    [ "$(head -1 "$f")" = "---" ] && basename "$f" .md
  done | sort -u
}
list_skill_specs() {
  for f in "$SKILL_SPECS_DIR"/*.eval.yaml; do
    [ -f "$f" ] && basename "$f" .eval.yaml
  done | sort -u
}
list_agent_specs() {
  for f in "$AGENT_SPECS_DIR"/*.eval.yaml; do
    [ -f "$f" ] && basename "$f" .eval.yaml
  done | sort -u
}

TMP_WORK="$(mktemp -d)"
trap 'rm -rf "$TMP_WORK"' EXIT

# nlines: line count of a file (empty file -> 0). No pipe-to-grep so an empty
# set never trips pipefail.
nlines() { local n; n="$(wc -l < "$1")"; echo "$((n))"; }

recompute() {
  list_skills       > "$TMP_WORK/skills"
  list_agents       > "$TMP_WORK/agents"
  list_skill_specs  > "$TMP_WORK/skill_specs"
  list_agent_specs  > "$TMP_WORK/agent_specs"
  comm -23 "$TMP_WORK/skills" "$TMP_WORK/skill_specs" > "$TMP_WORK/uncovered_skills"
  comm -23 "$TMP_WORK/agents" "$TMP_WORK/agent_specs" > "$TMP_WORK/uncovered_agents"
  comm -13 "$TMP_WORK/skills" "$TMP_WORK/skill_specs" > "$TMP_WORK/orphan_skill_specs"
  comm -13 "$TMP_WORK/agents" "$TMP_WORK/agent_specs" > "$TMP_WORK/orphan_agent_specs"
}
recompute

# ── --fill: generate a starter spec for each uncovered component ─────────────
if [ "$MODE" = "fill" ]; then
  filled=0
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    python3 "$GEN_HELPER" skill "$SKILLS_DIR/$name/SKILL.md" "$SKILL_SPECS_DIR/$name.eval.yaml"
    filled=$((filled + 1))
  done < "$TMP_WORK/uncovered_skills"
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    python3 "$GEN_HELPER" agent "$AGENTS_DIR/$name.md" "$AGENT_SPECS_DIR/$name.eval.yaml"
    filled=$((filled + 1))
  done < "$TMP_WORK/uncovered_agents"
  echo ""
  echo -e "${GREEN}Filled $filled starter spec(s).${NC} Re-run without --fill to confirm coverage."
  recompute   # reflect the freshly written specs in coverage.json + the table
fi

SKILLS_TOTAL=$(nlines "$TMP_WORK/skills")
AGENTS_TOTAL=$(nlines "$TMP_WORK/agents")
SKILLS_UNCOV=$(nlines "$TMP_WORK/uncovered_skills")
AGENTS_UNCOV=$(nlines "$TMP_WORK/uncovered_agents")
SKILLS_COV=$((SKILLS_TOTAL - SKILLS_UNCOV))
AGENTS_COV=$((AGENTS_TOTAL - AGENTS_UNCOV))

# ── Write coverage.json (jq-free; arrays built from the diff files) ──────────
json_array_from_file() {
  local out="" first=1 line
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [ $first -eq 1 ]; then out="\"$line\""; first=0; else out="$out,\"$line\""; fi
  done < "$1"
  echo "[$out]"
}

mkdir -p "$RESULTS_DIR"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
{
  echo "{"
  echo "  \"timestamp\": \"$TIMESTAMP\","
  echo "  \"uncovered_total\": $((SKILLS_UNCOV + AGENTS_UNCOV)),"
  echo "  \"skills\": {"
  echo "    \"total\": $SKILLS_TOTAL,"
  echo "    \"covered\": $SKILLS_COV,"
  echo "    \"uncovered\": $(json_array_from_file "$TMP_WORK/uncovered_skills"),"
  echo "    \"orphan_specs\": $(json_array_from_file "$TMP_WORK/orphan_skill_specs")"
  echo "  },"
  echo "  \"agents\": {"
  echo "    \"total\": $AGENTS_TOTAL,"
  echo "    \"covered\": $AGENTS_COV,"
  echo "    \"uncovered\": $(json_array_from_file "$TMP_WORK/uncovered_agents"),"
  echo "    \"orphan_specs\": $(json_array_from_file "$TMP_WORK/orphan_agent_specs")"
  echo "  }"
  echo "}"
} > "$COVERAGE_FILE"

# ── Report table ────────────────────────────────────────────────────────────
if [ "$MODE" = "report" ] || [ "$MODE" = "fill" ]; then
  echo ""
  echo -e "${BOLD}${BLUE}Eval Coverage${NC}"
  printf "  %-8s %8s %8s %10s\n" "kind" "total" "covered" "uncovered"
  printf "  %-8s %8s %8s %10s\n" "-----" "-----" "-------" "---------"
  sk_color=$GREEN; [ "$SKILLS_UNCOV" -gt 0 ] && sk_color=$YELLOW
  ag_color=$GREEN; [ "$AGENTS_UNCOV" -gt 0 ] && ag_color=$YELLOW
  printf "  %-8s %8s %8s ${sk_color}%10s${NC}\n" "skills" "$SKILLS_TOTAL" "$SKILLS_COV" "$SKILLS_UNCOV"
  printf "  %-8s %8s %8s ${ag_color}%10s${NC}\n" "agents" "$AGENTS_TOTAL" "$AGENTS_COV" "$AGENTS_UNCOV"
  if [ "$SKILLS_UNCOV" -gt 0 ]; then
    echo -e "\n  ${YELLOW}Uncovered skills:${NC}"
    while IFS= read -r n; do [ -n "$n" ] && echo "    $n"; done < "$TMP_WORK/uncovered_skills"
  fi
  if [ "$AGENTS_UNCOV" -gt 0 ]; then
    echo -e "\n  ${YELLOW}Uncovered agents:${NC}"
    while IFS= read -r n; do [ -n "$n" ] && echo "    $n"; done < "$TMP_WORK/uncovered_agents"
  fi
  if [ -s "$TMP_WORK/orphan_skill_specs" ] || [ -s "$TMP_WORK/orphan_agent_specs" ]; then
    echo -e "\n  ${YELLOW}Orphan specs (spec with no component):${NC}"
    while IFS= read -r n; do [ -n "$n" ] && echo "    skill: $n"; done < "$TMP_WORK/orphan_skill_specs"
    while IFS= read -r n; do [ -n "$n" ] && echo "    agent: $n"; done < "$TMP_WORK/orphan_agent_specs"
  fi
  echo -e "\n  Wrote: $COVERAGE_FILE"
fi

TOTAL_UNCOV=$((SKILLS_UNCOV + AGENTS_UNCOV))

if [ "$MODE" = "check" ]; then
  if [ "$TOTAL_UNCOV" -gt 0 ]; then
    echo -e "${RED}Eval coverage gap: $TOTAL_UNCOV component(s) without a spec.${NC}" >&2
    while IFS= read -r n; do [ -n "$n" ] && echo "skill: $n" >&2; done < "$TMP_WORK/uncovered_skills"
    while IFS= read -r n; do [ -n "$n" ] && echo "agent: $n" >&2; done < "$TMP_WORK/uncovered_agents"
    echo "Run: bash scripts/eval/eval-coverage.sh --fill" >&2
    exit 1
  fi
  echo -e "${GREEN}Eval coverage: all $((SKILLS_TOTAL + AGENTS_TOTAL)) components have a spec.${NC}"
fi

exit 0
