#!/usr/bin/env bash
# GH-2971: skill and agent docs must not teach removed Langfuse Python SDK
# v2/v3 calls, except on a line that is explicitly a migration note.
# Eval harness examples must assert a non-zero item count and a non-zero run count.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

FAIL=0
bad() { echo "✗ $1"; FAIL=1; }

# Same-line allow: the line itself says it is a migration note.
while IFS= read -r hit; do
  [[ -n "$hit" ]] || continue
  line="${hit#*:}"
  line="${line#*:}"
  if [[ "$line" != *"Migration note"* ]]; then
    bad "removed Langfuse API outside a migration note: $hit"
  fi
done < <(grep -RInE 'Langfuse\.client|DatasetItem\.link\(|langfuse\.trace\(|trace\.generation\(' src/skills src/agents --include='*.md' || true)

HARNESS="$ROOT/src/skills/testing-llm/references/langfuse-v4.md"
AGENT="$ROOT/src/agents/eval-runner.md"
for f in "$HARNESS" "$AGENT"; do
  grep -q 'len(items) == 0' "$f" || bad "$f missing zero-item assertion"
  grep -q 'dataset_runs' "$f" || bad "$f missing zero-run assertion"
done
grep -q 'run_batched_evaluation' "$HARNESS" || bad "langfuse-v4.md missing run_batched_evaluation"
grep -q 'start_observation' "$HARNESS" || bad "langfuse-v4.md missing start_observation"
grep -q 'dataset.run_experiment' "$HARNESS" || bad "langfuse-v4.md missing dataset.run_experiment"
grep -q 'propagate_attributes' "$HARNESS" || bad "langfuse-v4.md missing propagate_attributes"

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "✓ Langfuse v4 docs: removed APIs only in migration notes, harnesses assert non-zero items and runs"
