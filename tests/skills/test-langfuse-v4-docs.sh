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

# Wrong v4 call patterns the reviewer verified against langfuse-python 4.x:
# - `start_observation` is not a context manager (`with ...` raises
#   TypeError on 3.11+); the `with` form is start_as_current_observation.
# - run_experiment's local-items kwarg is `data=`, not `dataset=`.
# - `len(items) == 0 or len(run_ids) == 0` always fires on local data=[...]
#   runs because they never record a dataset_run_id.
while IFS= read -r hit; do
  [[ -n "$hit" ]] || continue
  bad "start_observation used as a context manager: $hit"
done < <(grep -RInE 'with +[^ ]*\.start_observation *\(' src/skills src/agents --include='*.md' || true)

while IFS= read -r hit; do
  [[ -n "$hit" ]] || continue
  bad "run_experiment called with dataset= kwarg (want data=): $hit"
done < <(grep -RInE 'run_experiment\([^)]*dataset=' src/skills src/agents --include='*.md' || true)

while IFS= read -r hit; do
  [[ -n "$hit" ]] || continue
  bad "unconditional dataset_runs guard fires on local data= runs: $hit"
done < <(grep -RInE 'len\(items\) == 0 or len\(run_ids\) == 0' src/skills src/agents --include='*.md' || true)

# `dataset is not None` is a wrong remote-run proxy: get_dataset raises
# rather than returning None (always true), a local-only harness NameErrors,
# and a dataset fetched just to build data=[...] false-fails a good run.
while IFS= read -r hit; do
  [[ -n "$hit" ]] || continue
  bad "variable-name proxy for remote dataset runs: $hit"
done < <(grep -RInE 'dataset is not None' src/skills src/agents --include='*.md' || true)

grep -q 'run_batched_evaluation' "$HARNESS" || bad "langfuse-v4.md missing run_batched_evaluation"
grep -q 'start_as_current_observation' "$HARNESS" || bad "langfuse-v4.md missing start_as_current_observation"
grep -q 'dataset.run_experiment' "$HARNESS" || bad "langfuse-v4.md missing dataset.run_experiment"
grep -q 'propagate_attributes' "$HARNESS" || bad "langfuse-v4.md missing propagate_attributes"

# The zero-run guard must EXECUTE correctly, not just exist as text:
# extract the python fence under "## Throughput assertion" and run it
# against ExperimentItemResult-shaped rows (dataset_id lives on row.item,
# not on the result row itself).
GUARD_SNIPPET="$(awk '
  /^## Throughput assertion/ {s=1}
  s && /^```python$/ {f=1; next}
  f && /^```$/ {exit}
  f {print}
' "$HARNESS")"
[[ -n "$GUARD_SNIPPET" ]] || bad "langfuse-v4.md: no python block under 'Throughput assertion'"

if [[ -n "$GUARD_SNIPPET" ]]; then
  GUARD_TMP="$(mktemp -d "${TMPDIR:-/tmp}/ork-lf-guard.XXXXXX")"
  printf '%s\n' "$GUARD_SNIPPET" > "$GUARD_TMP/guard.py"
  cat > "$GUARD_TMP/probe.py" <<'PYEOF'
import sys
import types

guard = open(sys.argv[1], encoding="utf-8").read()


class Item:
    def __init__(self, dataset_id):
        self.dataset_id = dataset_id


class Row:
    # Mirrors langfuse ExperimentItemResult (item, output, evaluations,
    # trace_id, dataset_run_id): dataset_id lives on row.item, not row.
    def __init__(self, item=None, run_id=None):
        self.item = item
        self.output = "out"
        self.evaluations = []
        self.trace_id = "t"
        self.dataset_run_id = run_id


def run(rows):
    ns = {"result": types.SimpleNamespace(item_results=rows)}
    try:
        exec(compile(guard, "guard", "exec"), ns)
    except RuntimeError as exc:
        return str(exc)
    return None


remote_zero = [Row(item=Item("ds-1")), Row(item=Item("ds-1"))]
remote_ok = [Row(item=Item("ds-1"), run_id="run-9")]
local = [Row(item={"input": 1}), Row(item={"input": 2})]

checks = [
    ("remote rows with 0 recorded runs raise", run(remote_zero) is not None),
    ("remote rows with a recorded run pass", run(remote_ok) is None),
    ("local data=[...] rows pass", run(local) is None),
    ("zero items raise", run([]) is not None),
]
ok = True
for name, passed in checks:
    print(("PASS" if passed else "FAIL") + " " + name)
    ok = ok and passed
sys.exit(0 if ok else 1)
PYEOF
  python3 "$GUARD_TMP/probe.py" "$GUARD_TMP/guard.py" || bad "throughput guard fails on remote zero-run fixtures"
  rm -rf "$GUARD_TMP"
fi

if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "✓ Langfuse v4 docs: removed APIs only in migration notes, harnesses assert non-zero items and runs"
