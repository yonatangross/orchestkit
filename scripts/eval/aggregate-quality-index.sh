#!/usr/bin/env bash
# ============================================================================
# Quality Index Aggregator — OrchestKit (#2194)
# ============================================================================
# Reads committed-shape eval result JSONs and reduces them to a single
# per-component quality index, deterministically. No LLM, no network, no gh.
#
#   <skill>.trigger.json  -> precision / recall / effective_* (0..100)
#   <skill>.quality.json  -> aggregate.skill_pass_rate (0..1 or 0..100)
#
# Each metric is normalized to 0..1; a component's `score` is the mean of the
# normalized metrics that exist. `overall.index` is the mean of component
# scores. Components with no numeric signal are skipped (not scored 0).
#
# Usage:
#   bash scripts/eval/aggregate-quality-index.sh
#   EVAL_RESULTS_DIR=<dir> EVAL_INDEX_OUT=<file> bash scripts/eval/aggregate-quality-index.sh
#   bash scripts/eval/aggregate-quality-index.sh --results-dir <dir> --out <file>
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"

RESULTS_DIR="${EVAL_RESULTS_DIR:-$PROJECT_ROOT/tests/evals/results/skills}"
OUT_FILE="${EVAL_INDEX_OUT:-$PROJECT_ROOT/tests/evals/results/quality-index.json}"

while [ $# -gt 0 ]; do
  case "$1" in
    --results-dir) RESULTS_DIR="$2"; shift 2 ;;
    --out) OUT_FILE="$2"; shift 2 ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

if ! command -v jq >/dev/null; then
  echo "jq is required" >&2
  exit 3
fi

# normalize: map a metric to 0..1. Blank/null -> empty (metric absent).
# Values > 1 are treated as a 0..100 percentage.
norm() {
  awk -v x="${1:-}" 'BEGIN{
    if (x == "" || x == "null") { exit 0 }
    v = x + 0
    if (v > 1) v = v / 100
    if (v < 0) v = 0
    if (v > 1) v = 1
    printf "%.4f", v
  }'
}

mean_of() {
  # mean of the non-empty numeric args, or empty if none
  awk 'BEGIN{
    n = 0; s = 0
    for (i = 1; i < ARGC; i++) {
      if (ARGV[i] != "") { s += ARGV[i]; n++ }
    }
    if (n == 0) exit 0
    printf "%.4f", s / n
  }' "$@"
}

# Read a metric from a result file. The file existence is checked by the caller;
# a malformed file makes jq fail and (under set -e) aborts loudly rather than
# silently scoring the component as absent.
read_metric() {
  local file="$1" filter="$2"
  jq -r "$filter // empty" "$file"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Union of skill ids seen across trigger + quality result files.
: > "$TMP/skills"
if [ -d "$RESULTS_DIR" ]; then
  for f in "$RESULTS_DIR"/*.trigger.json; do
    [ -f "$f" ] && basename "$f" .trigger.json >> "$TMP/skills"
  done
  for f in "$RESULTS_DIR"/*.quality.json; do
    [ -f "$f" ] && basename "$f" .quality.json >> "$TMP/skills"
  done
fi
sort -u "$TMP/skills" -o "$TMP/skills"

# Build the components object one entry at a time.
: > "$TMP/entries"
while IFS= read -r skill; do
  [ -z "$skill" ] && continue
  tf="$RESULTS_DIR/$skill.trigger.json"
  qf="$RESULTS_DIR/$skill.quality.json"

  eff_p=""; eff_r=""; q_rate=""; trig_score=""; qual_score=""
  if [ -f "$tf" ]; then
    eff_p="$(norm "$(read_metric "$tf" '(.effective_precision // .precision)')")"
    eff_r="$(norm "$(read_metric "$tf" '(.effective_recall // .recall)')")"
    trig_score="$(mean_of "$eff_p" "$eff_r")"
  fi
  if [ -f "$qf" ]; then
    q_rate="$(norm "$(read_metric "$qf" '.aggregate.skill_pass_rate')")"
    qual_score="$q_rate"
  fi

  score="$(mean_of "$trig_score" "$qual_score")"
  [ -z "$score" ] && continue   # no numeric signal: do not fabricate a 0

  # jq-null for absent metrics so the record is honest about what was measured.
  jq -n \
    --arg skill "$skill" \
    --arg score "$score" \
    --arg ep "$eff_p" --arg er "$eff_r" --arg qr "$q_rate" \
    '{
       ($skill): {
         score: ($score|tonumber),
         effective_precision: (if $ep == "" then null else ($ep|tonumber) end),
         effective_recall: (if $er == "" then null else ($er|tonumber) end),
         quality_pass_rate: (if $qr == "" then null else ($qr|tonumber) end)
       }
     }' >> "$TMP/entries"
done < "$TMP/skills"

# Merge entries -> components object (empty object when no entries).
if [ -s "$TMP/entries" ]; then
  jq -s 'add' "$TMP/entries" > "$TMP/components.json"
else
  echo '{}' > "$TMP/components.json"
fi

COUNT="$(jq 'length' "$TMP/components.json")"
OVERALL="$(jq '[.[].score] | if length == 0 then null else (add / length) end' "$TMP/components.json")"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$(dirname "$OUT_FILE")"
jq -n \
  --arg ts "$TS" \
  --arg results_dir "$RESULTS_DIR" \
  --argjson components "$(cat "$TMP/components.json")" \
  --argjson count "$COUNT" \
  --argjson overall "$OVERALL" \
  '{
     generated: $ts,
     results_dir: $results_dir,
     overall: { count: $count, index: $overall },
     components: $components
   }' > "$OUT_FILE"

echo "Wrote $OUT_FILE ($COUNT component(s), overall index: $OVERALL)"
