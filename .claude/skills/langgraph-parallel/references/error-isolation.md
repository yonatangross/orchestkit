# Error Isolation Pattern

Handle failures in parallel branches without losing successful results.

## Implementation

```python
import asyncio
from typing import TypedDict

class ParallelResult(TypedDict):
    successes: list[dict]
    failures: list[dict]

async def parallel_with_isolation(
    tasks: list[callable],
    timeout: int = 30
) -> ParallelResult:
    """Run parallel tasks, isolate failures."""
    async def safe_run(task, idx):
        try:
            return await asyncio.wait_for(task(), timeout=timeout)
        except asyncio.TimeoutError:
            return {"error": "timeout", "task_idx": idx}
        except Exception as e:
            return {"error": str(e), "task_idx": idx}

    results = await asyncio.gather(
        *[safe_run(t, i) for i, t in enumerate(tasks)],
        return_exceptions=False  # Handled internally
    )

    return {
        "successes": [r for r in results if "error" not in r],
        "failures": [r for r in results if "error" in r]
    }

# Usage in node
async def parallel_agents_node(state: WorkflowState) -> dict:
    agents = [security_agent, tech_agent, quality_agent]
    result = await parallel_with_isolation(
        [lambda a=a: a.analyze(state["input"]) for a in agents]
    )
    return {"findings": result["successes"], "errors": result["failures"]}
```

## When to Use

- Parallel LLM calls that may fail
- Multi-service aggregation
- Graceful degradation requirements
- Partial results are acceptable

## Anti-patterns

- Using `return_exceptions=True` without checking types
- No logging of failures
- Ignoring all results on any failure
- No retry for transient failures