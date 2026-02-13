---
title: Map-Reduce Pattern
impact: HIGH
impactDescription: "Using sequential processing for independent tasks wastes time — use asyncio.gather"
tags: parallel, map-reduce, asyncio, gather, concurrent
---

## Map-Reduce Pattern

Use `asyncio.gather` for async parallel processing within a single node, or `Send` for graph-level parallelism.

**Incorrect — sequential in async context:**
```python
async def process_all(state):
    results = []
    for item in state["items"]:
        result = await process_item(item)  # Sequential await!
        results.append(result)
    return {"results": results}
```

**Correct — parallel with asyncio.gather:**
```python
import asyncio

async def parallel_map(items: list, process_fn) -> list:
    """Map: process all items concurrently."""
    tasks = [asyncio.create_task(process_fn(item)) for item in items]
    return await asyncio.gather(*tasks, return_exceptions=True)

def reduce_results(results: list) -> dict:
    """Reduce: combine all results."""
    successes = [r for r in results if not isinstance(r, Exception)]
    failures = [r for r in results if isinstance(r, Exception)]
    return {
        "total": len(results),
        "passed": len(successes),
        "failed": len(failures),
        "results": successes,
        "errors": [str(e) for e in failures],
    }

async def map_reduce_node(state: State) -> dict:
    results = await parallel_map(state["items"], process_item_async)
    return {"summary": reduce_results(results)}
```

**Key rules:**
- Use `asyncio.gather` for I/O-bound parallel work within a node
- Use `Send` API for graph-level parallelism across nodes
- Always use `return_exceptions=True` to prevent one failure killing all
- Max 5-10 concurrent tasks to avoid overwhelming APIs

Reference: [LangGraph Parallel Execution](https://langchain-ai.github.io/langgraph/how-tos/map-reduce/)
