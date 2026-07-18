#!/bin/bash
# =============================================================================
# OrchestKit Eval Regression Gate (#2194)
# =============================================================================
# Compares a freshly aggregated quality index against a COMMITTED baseline and
# fails when a measured component regresses or disappears. No Claude API calls,
# no network — pure jq/bash over committed-shape result JSONs.
#
# Pipeline:
#   1. Run scripts/eval/aggregate-quality-index.sh over the results dir.
#   2. Load the committed baseline (tests/evals/quality-index.baseline.json).
#   3. Fail (exit 1) if any baseline component is missing from the fresh index
#      (coverage cannot silently vanish once data lands) or its score dropped
#      by more than the threshold (default 0.05, EVAL_REGRESSION_THRESHOLD).
#
# Empty-state: when the baseline has zero components, this gate is a NO-OP. It
# prints a loud notice and exits 0 — it does NOT report a green quality PASS,
# because nothing has been measured yet. Seed the baseline from a real (paid)
# eval run with --update-baseline to make the gate meaningful.
#
# Usage:
#   bash tests/evals/scripts/check-eval-regression.sh
#   bash tests/evals/scripts/check-eval-regression.sh --update-baseline
#   EVAL_REGRESSION_THRESHOLD=0.10 bash tests/evals/scripts/check-eval-regression.sh
#   bash tests/evals/scripts/check-eval-regression.sh \
#       --baseline <file> --results-dir <dir> --threshold 0.05
#
# Exit codes: 0 = no regression (or no-op empty state); 1 = regression detected.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVALS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$EVALS_DIR/../.." && pwd)"

AGG="$ROOT_DIR/scripts/eval/aggregate-quality-index.sh"
BASELINE="${EVAL_BASELINE:-$EVALS_DIR/quality-index.baseline.json}"
RESULTS_DIR="${EVAL_RESULTS_DIR:-$EVALS_DIR/results/skills}"
CURRENT="${EVAL_INDEX_OUT:-$EVALS_DIR/results/quality-index.json}"
THRESHOLD="${EVAL_REGRESSION_THRESHOLD:-0.05}"
UPDATE_BASELINE=false

while [ $# -gt 0 ]; do
  case "$1" in
    --baseline) BASELINE="$2"; shift 2 ;;
    --results-dir) RESULTS_DIR="$2"; shift 2 ;;
    --out|--current) CURRENT="$2"; shift 2 ;;
    --threshold) THRESHOLD="$2"; shift 2 ;;
    --update-baseline) UPDATE_BASELINE=true; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

command -v jq >/dev/null || { echo "jq is required" >&2; exit 3; }
[ -f "$AGG" ] || { echo "aggregator not found: $AGG" >&2; exit 3; }

# Aggregate the current results into the fresh index.
EVAL_RESULTS_DIR="$RESULTS_DIR" EVAL_INDEX_OUT="$CURRENT" bash "$AGG" >/dev/null

if [ "$UPDATE_BASELINE" = true ]; then
  cp "$CURRENT" "$BASELINE"
  cnt="$(jq '.components | length' "$BASELINE")"
  echo -e "${GREEN}Baseline updated from current results ($cnt component(s)): $BASELINE${NC}"
  exit 0
fi

if [ ! -f "$BASELINE" ]; then
  echo -e "${RED}Baseline missing: $BASELINE${NC}" >&2
  echo "Seed it with: bash tests/evals/scripts/check-eval-regression.sh --update-baseline" >&2
  exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  EVAL REGRESSION GATE (#2194)${NC}"
echo -e "${BLUE}============================================================${NC}"
echo -e "  baseline:  $BASELINE"
echo -e "  current:   $CURRENT"
echo -e "  threshold: $THRESHOLD"
echo ""

BASE_COUNT="$(jq '.components | length' "$BASELINE")"
CUR_COUNT="$(jq '.components | length' "$CURRENT")"

# Empty-state: nothing has been measured yet. Loud no-op, not a green PASS.
if [ "$BASE_COUNT" -eq 0 ]; then
  echo -e "${YELLOW}▲ 0 components measured — gate is a NO-OP until a paid eval run seeds the baseline.${NC}"
  echo -e "${YELLOW}  This is NOT a quality PASS; no component scores exist to compare.${NC}"
  echo -e "${YELLOW}  Seed: run the paid eval suite, then --update-baseline.${NC}"
  echo -e "${BLUE}============================================================${NC}"
  exit 0
fi

REGRESSIONS=0
CHECKED=0

while IFS= read -r name; do
  [ -z "$name" ] && continue
  CHECKED=$((CHECKED + 1))
  base_score="$(jq -r --arg n "$name" '.components[$n].score' "$BASELINE")"
  cur_score="$(jq -r --arg n "$name" '.components[$n].score // empty' "$CURRENT")"

  if [ -z "$cur_score" ]; then
    echo -e "  ${RED}✗ $name — DISAPPEARED (in baseline, absent from current)${NC}"
    REGRESSIONS=$((REGRESSIONS + 1))
    continue
  fi

  verdict="$(awk -v b="$base_score" -v c="$cur_score" -v t="$THRESHOLD" 'BEGIN{
    d = b - c
    if (d > t) printf "REGRESS %.4f", d
    else printf "OK %.4f", d
  }')"
  drop="${verdict#* }"
  if [ "${verdict%% *}" = "REGRESS" ]; then
    printf "  ${RED}✗ %s — REGRESSED: %s -> %s (drop %s > %s)${NC}\n" "$name" "$base_score" "$cur_score" "$drop" "$THRESHOLD"
    REGRESSIONS=$((REGRESSIONS + 1))
  else
    printf "  ${GREEN}✓ %s — %s -> %s${NC}\n" "$name" "$base_score" "$cur_score"
  fi
done < <(jq -r '.components | keys[]' "$BASELINE")

# New components (present in current, not in baseline) are informational.
if [ "$CUR_COUNT" -gt "$BASE_COUNT" ]; then
  echo -e "  ${BLUE}i $((CUR_COUNT - BASE_COUNT)) new component(s) measured (not yet in baseline)${NC}"
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "  Checked: $CHECKED   Regressions: $REGRESSIONS"
if [ "$REGRESSIONS" -gt 0 ]; then
  echo -e "${RED}RESULT: FAILED ($REGRESSIONS regression(s))${NC}"
  echo -e "  Accept an intentional change with: --update-baseline"
  echo -e "${BLUE}============================================================${NC}"
  exit 1
fi
echo -e "${GREEN}RESULT: PASSED (no regressions across $CHECKED measured component(s))${NC}"
echo -e "${BLUE}============================================================${NC}"
exit 0
