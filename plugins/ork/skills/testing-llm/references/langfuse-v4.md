# Langfuse Python SDK v4 for eval harnesses

Verified against `langfuse-python` `main` (`start_observation`, `run_experiment`, `run_batched_evaluation`). Migration note: v4 removed `Langfuse.client`, `DatasetItem.link()`, and the v2/v3 `langfuse.trace()` / `trace.generation()` / `trace.span()` builders. Failures from those calls were logged at debug and a harness could exit 0 after processing nothing. Do not generate the removed calls except inside a migration note.

## Trace

```python
from langfuse import get_client, observe, propagate_attributes

@observe(name="eval-item")
def score_item(item):
    langfuse = get_client()
    with propagate_attributes(metadata={"dataset_item": item.id}):
        with langfuse.start_as_current_observation(name="grade", as_type="evaluator") as obs:
            obs.update(output={"score": 1})
            return 1
```

`start_observation` returns a span object, not a context manager — putting it inside `with` raises `AttributeError: __enter__`. The `with` form is `start_as_current_observation`. Prefer `@observe` when the function boundary is the span.

## Dataset run

```python
langfuse = get_client()
dataset = langfuse.get_dataset("golden")

def task(*, item, **kwargs):
    return score_item(item)

result = dataset.run_experiment(name="golden-v4", task=task)
```

Local items, no remote dataset: `langfuse.run_experiment(name="...", data=[...], task=task)` — the kwarg is `data`, not `dataset`.

Existing traces, not a dataset: `langfuse.run_batched_evaluation(scope="traces", mapper=to_inputs, evaluators=[...])`. That reader still talks to the platform v3 traces API. Do not use it as a substitute for `dataset.run_experiment` on a golden set.

## Throughput assertion (required)

A harness that swallows the old API and reports success is worse than a red run. After `run_experiment`, always fail on zero processed items; a remote `dataset.run_experiment` must also have recorded a dataset run:

```python
items = list(getattr(result, "item_results", None) or [])
if len(items) == 0:
    raise RuntimeError("eval no-op: items=0")
# dataset.run_experiment records a dataset_run_id per item; a local
# run_experiment(data=[...]) never does, so asserting it unconditionally
# fails every local run. Only remote dataset runs carry the id.
run_ids = {row.dataset_run_id for row in items if getattr(row, "dataset_run_id", None)}
if dataset is not None and len(run_ids) == 0:
    raise RuntimeError(f"eval no-op: dataset_runs={len(run_ids)}")
```

Same bar for `run_batched_evaluation`: the returned processed count must be greater than zero. Zero items is a failed harness, not a quiet pass.
