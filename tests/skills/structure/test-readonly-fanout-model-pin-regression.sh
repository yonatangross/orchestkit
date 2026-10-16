#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIXTURE="$SCRIPT_DIR/fixtures/readonly-fanout/prompt-model-decoy.md"
LOG=$(mktemp "${TMPDIR:-/tmp}/readonly-fanout-decoy.XXXXXX")
trap 'rm -f "$LOG"' EXIT

if FANOUT_RULE_PATH="$FIXTURE" bash "$SCRIPT_DIR/test-readonly-fanout-model-pin.sh" > "$LOG" 2>&1; then
  echo 'FAIL: model="sonnet" passed because prompt text contained model="haiku"'
  cat "$LOG"
  exit 1
fi
if ! grep -Fq 'do not pin model="haiku"' "$LOG"; then
  echo "FAIL: fixture failed for a reason other than its model argument"
  cat "$LOG"
  exit 1
fi
echo 'PASS: model="sonnet" is rejected despite model="haiku" in prompt text'

PLAIN_FIXTURE="$SCRIPT_DIR/fixtures/readonly-fanout/plain-fence-unpinned.md"
if FANOUT_RULE_PATH="$PLAIN_FIXTURE" bash "$SCRIPT_DIR/test-readonly-fanout-model-pin.sh" > "$LOG" 2>&1; then
  echo 'FAIL: an unpinned Explore call in a plain fence passed'
  cat "$LOG"
  exit 1
fi
if ! grep -Fq 'Explore spawn count mismatch: AST found 1, whole file contains 2' "$LOG"; then
  echo 'FAIL: the plain fence fixture failed without detecting the missing Explore call'
  cat "$LOG"
  exit 1
fi
echo 'PASS: an unpinned Explore call in a plain fence is rejected by the count check'
