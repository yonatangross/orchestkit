#!/usr/bin/env bash
# Run the `claude plugin eval` suite for the ork plugin.
#
# Why this wrapper exists:
#   1. `claude plugin eval` reads cases from a directory BELOW the plugin root,
#      but scripts/build-plugins.sh wipes plugins/ wholesale on every build, so
#      plugins/ork/evals cannot be the cases' tracked home. The tracked home is
#      evals/ at the repo root; this script stages it into the plugin.
#   2. The HTML report is published to claude.ai by DEFAULT. Every run here
#      passes --no-publish. Do not remove that flag.
#   3. Results are written outside plugins/ so a later build does not delete them.
#
# Sizing the ceiling, measured on the 2026-09-12 pilot rather than guessed:
#   a with-plugin run costs $0.31 to $0.54, a baseline run $0.07 to $0.11, and
#   judging is about 2% of spend. So 9 cases x 1 run x 2 arms is roughly $4, and
#   9 cases x 3 runs x 2 arms is roughly $13 to $15. The default $3 ceiling will
#   TRUNCATE a full 9-case pilot; pass --max-cost-usd 6 to let it finish.
#
# Usage:
#   bash scripts/run-plugin-eval.sh --max-cost-usd 6   # pilot: 1 run per case
#   bash scripts/run-plugin-eval.sh                 # pilot: 1 run per case, $3 ceiling
#   bash scripts/run-plugin-eval.sh --runs 3 --max-cost-usd 10
#   bash scripts/run-plugin-eval.sh --case '2*'     # one skill's cases only
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SRC_EVALS="$REPO_ROOT/evals"
PLUGIN_DIR="$REPO_ROOT/plugins/ork"
STAGED="$PLUGIN_DIR/evals"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$REPO_ROOT/evals/results/$STAMP"

RUNS=1
MAX_COST=3
JUDGE_MODEL=sonnet
EXTRA=()

while [ $# -gt 0 ]; do
  case "$1" in
    --runs) RUNS="$2"; shift 2 ;;
    --max-cost-usd) MAX_COST="$2"; shift 2 ;;
    --judge-model) JUDGE_MODEL="$2"; shift 2 ;;
    *) EXTRA+=("$1"); shift ;;
  esac
done

if [ ! -d "$SRC_EVALS" ]; then
  echo "no eval cases at $SRC_EVALS" >&2; exit 1
fi
if [ ! -f "$PLUGIN_DIR/plugin.json" ]; then
  echo "plugins/ork is not built. Run: npm run build" >&2; exit 1
fi

# Stage the tracked cases into the plugin. results/ never goes in.
rm -rf "$STAGED"
mkdir -p "$STAGED"
tar -cf - -C "$SRC_EVALS" --exclude results . | tar -xf - -C "$STAGED"

mkdir -p "$OUT_DIR"
echo "cases:   $SRC_EVALS  ->  $STAGED"
echo "results: $OUT_DIR"
echo "runs:    $RUNS   ceiling: \$$MAX_COST   judge: $JUDGE_MODEL"
echo

set +e
claude plugin eval "$PLUGIN_DIR" \
  --ablation with-without \
  --runs "$RUNS" \
  --judge-model "$JUDGE_MODEL" \
  --max-cost-usd "$MAX_COST" \
  --no-scaffold \
  --no-publish \
  --trust-plugin \
  --output-dir "$OUT_DIR" \
  --json "$OUT_DIR/run.json" \
  "${EXTRA[@]}"
RC=$?
set -e

# Keep the staged copy out of the built plugin so `npm run build` diffs stay clean.
rm -rf "$STAGED"

echo
echo "exit code: $RC   (1 = a case scored below --threshold, 2 = cost ceiling hit)"
echo "raw report: $OUT_DIR"
exit $RC
