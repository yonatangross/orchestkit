---
title: Recover exhausted nodes with error_handler= instead of wrapping every node body in try/except
impact: HIGH
impactDescription: "A node that swallows its own exceptions defeats the retry policy and hides failures from checkpoints; an unhandled one kills the whole run"
tags: resilience, error-handling, recovery, retry, command
---

## Node Error Handlers (1.2+)

`add_node(..., error_handler=)` registers a **node** that runs after the retry budget is exhausted.
It receives the failure context and can update state and route elsewhere via `Command`.

**Incorrect:**

```python
def enrich(state: State) -> dict:
    try:
        return {"data": vendor.fetch(state["id"])}
    except Exception as e:
        # Swallowed. The retry policy sees a SUCCESS and never retries.
        # The failure is invisible in the checkpoint and to any downstream branch.
        return {"data": None, "error": str(e)}
```

**Correct:**

```python
from langgraph.errors import NodeError
from langgraph.types import Command, RetryPolicy

def enrich(state: State) -> dict:
    # Let it raise. Retries are the framework's job.
    return {"data": vendor.fetch(state["id"])}

def enrich_failed(state: State, error: NodeError) -> Command:
    # Reached only after every retry is exhausted.
    return Command(
        update={"data": None, "failure": f"{error.node}: {error.error}"},
        goto="degraded_path",
    )

builder.add_node(
    "enrich",
    enrich,
    retry_policy=RetryPolicy(max_attempts=3),
    error_handler=enrich_failed,
)
```

### Getting the failure context

The handler is an ordinary node. To receive the failure, declare a parameter **typed** `NodeError` —
injection is by type annotation, not by position or name:

```python
def handler(state: State, error: NodeError) -> Command: ...
```

`NodeError` is a frozen dataclass with exactly two fields:

| Field | Type | Meaning |
|---|---|---|
| `node` | `str` | Name of the node that failed |
| `error` | `BaseException` | The exception it raised |

Branch on the concrete exception type, not on message text:

```python
def handler(state: State, error: NodeError) -> Command:
    if isinstance(error.error, NodeTimeoutError):
        return Command(update={"status": "timed_out"}, goto="slow_path")
    if isinstance(error.error, RateLimitError):
        return Command(update={"status": "throttled"}, goto="queue_for_later")
    raise error.error   # re-raise what you cannot handle — do not swallow
```

### Retry policy ordering

`retry_policy` accepts a `RetryPolicy` **or a sequence**; the first policy whose `retry_on` matches
is applied. Order narrowest-first:

```python
retry_policy=[
    RetryPolicy(retry_on=RateLimitError, max_attempts=6, initial_interval=2.0),
    RetryPolicy(retry_on=ConnectionError, max_attempts=3),
]
```

Defaults are `initial_interval=0.5`, `backoff_factor=2.0`, `max_interval=128.0`, `max_attempts=3`,
`jitter=True`.

- Do not catch-and-return inside a node body — you disable retries and lose the error in the checkpoint
- An `error_handler` that returns `Command(goto=...)` is how you express a fallback branch
- Re-raise `error.error` for cases the handler does not genuinely recover from
