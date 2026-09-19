# Langfuse Python SDK v4 for eval harnesses

Verified against `langfuse-python` `main` (`start_observation`, `run_experiment`, `run_batched_evaluation`). Migration note: v4 removed `Langfuse.client`, `DatasetItem.link()`, and the v2/v3 `langfuse.trace()` / `trace.generation()` / `trace.span()` builders. Failures from those calls were logged at debug and a harness could exit 0 after processing nothing. Do not generate the removed calls except inside a migration note.

## Trace

```python
from langfuse import get_client, observe, propagate_attributes

@observe(name="eval-item")
def score_item(item):
    langfuse = get_client()
    with propagate_attributes(metadata={"dataset_item": item.id}):
        with langfuse.start_observation(name="grade", as_type="evaluator") as obs:
            obs.update(output={"score": 1})
            return 1
```

`start_as_current_observation` is the context-manager form of the same idea. Prefer `@observe` when the function boundary is the span.

## Dataset run

```python
langfuse = get_client()
dataset = langfuse.get_dataset("golden")

def task(*, item, **kwargs):
    return score_item(item)

result = dataset.run_experiment(name="golden-v4", task=task)
```

Local items, no remote dataset: `langfuse.run_experiment(name="...", dataset=[...], task=task)`.

Existing traces, not a dataset: `langfuse.run_batched_evaluation(scope="traces", mapper=to_inputs, evaluators=[...])`. That reader still talks to the platform v3 traces API. Do not use it as a substitute for `dataset.run_experiment` on a golden set.

## Throughput assertion (required)

A harness that swallows the old API and reports success is worse than a red run. After `run_experiment`, fail if nothing was processed or no dataset run was recorded:

```python
items = list(getattr(result, "item_results", None) or [])
run_ids = {row.dataset_run_id for row in items if getattr(row, "dataset_run_id", None)}
if len(items) == 0 or len(run_ids) == 0:
    raise RuntimeError(
        f"eval no-op: items={len(items)} dataset_runs={len(run_ids)}"
    )
```

Same bar for `run_batched_evaluation`: the returned processed count must be greater than zero. Zero items or zero runs is a failed harness, not a quiet pass.
