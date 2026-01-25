# Map-Reduce Pattern

Process collections with map and aggregate with reduce.

## Implementation

```python
from typing import TypedDict, Annotated
from operator import add

class MapReduceState(TypedDict):
    items: list[dict]
    mapped: Annotated[list[dict], add]
    reduced: dict | None

async def map_node(state: MapReduceState) -> dict:
    """Map: Process each item independently."""
    results = await asyncio.gather(*[
        process_item(item) for item in state["items"]
    ])
    return {"mapped": list(results)}

def reduce_node(state: MapReduceState) -> dict:
    """Reduce: Aggregate all mapped results."""
    mapped = state["mapped"]
    return {
        "reduced": {
            "total": len(mapped),
            "passed": sum(1 for r in mapped if r.get("passed")),
            "failed": sum(1 for r in mapped if not r.get("passed")),
            "avg_score": sum(r.get("score", 0) for r in mapped) / len(mapped)
        }
    }

workflow = StateGraph(MapReduceState)
workflow.add_node("map", map_node)
workflow.add_node("reduce", reduce_node)
workflow.add_edge("map", "reduce")
```

## When to Use

- Batch processing of items
- Aggregating metrics from multiple sources
- Summarizing parallel analysis results
- Statistical aggregation workflows

## Anti-patterns

- Processing items sequentially in map (use asyncio.gather)
- Empty list handling not considered
- Reduce logic too complex (break into steps)
- No progress tracking for large batches