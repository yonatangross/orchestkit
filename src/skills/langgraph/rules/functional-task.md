---
title: "@task Decorator and Futures"
impact: MEDIUM
impactDescription: "Forgetting .result() on task futures silently returns a Future object instead of the actual value"
tags: functional, task, futures, parallel, result
---

## @task Decorator and Futures

`@task` functions return futures. Call `.result()` to get the value. Launch multiple tasks before calling `.result()` for parallelism.

**Incorrect — forgetting .result():**
```python
@task
def process(data: str) -> str:
    return transform(data)

@entrypoint()
def workflow(data: str) -> str:
    result = process(data)  # result is a Future, not a string!
    return result  # Returns Future object, not the processed string
```

**Correct — parallel execution with futures:**
```python
@task
def fetch_source_a(query: str) -> dict:
    return api_a.search(query)

@task
def fetch_source_b(query: str) -> dict:
    return api_b.search(query)

@entrypoint()
def parallel_search(query: str) -> dict:
    # Launch in parallel — futures start immediately
    future_a = fetch_source_a(query)
    future_b = fetch_source_b(query)

    # Block on both results
    results = [future_a.result(), future_b.result()]
    return {"combined": results}
```

**Map over collection:**
```python
@task
def process_item(item: dict) -> dict:
    return transform(item)

@entrypoint()
def batch_workflow(items: list[dict]) -> list[dict]:
    futures = [process_item(item) for item in items]  # All launch in parallel
    return [f.result() for f in futures]  # Collect all results
```

**Key rules:**
- `@task` returns a future — always call `.result()` to get the value
- Launch tasks before blocking on `.result()` for parallel execution
- Tasks inside `@entrypoint` are tracked for persistence and streaming
- Don't nest `@entrypoint` inside `@entrypoint`

Reference: [LangGraph Functional API](https://langchain-ai.github.io/langgraph/concepts/functional_api/)
