---
title: Implement retry loops with max counter to prevent infinite resource consumption
impact: HIGH
impactDescription: "No max retry counter creates infinite loops that consume resources forever"
tags: routing, retry, loop, error-handling
---

## Prefer the framework's retry primitives (1.2+)

Since 1.2, retries, timeouts and recovery are declarative on `add_node`. Reach for a hand-rolled
loop-back edge only when pinned below 1.2, or when a "retry" means *re-planning* rather than
re-running the same node.

**Preferred:**

```python
from langgraph.types import RetryPolicy, TimeoutPolicy
from langgraph.errors import NodeError, NodeTimeoutError

builder.add_node(
    "llm_call",
    llm_call,
    retry_policy=RetryPolicy(max_attempts=3, initial_interval=0.5, backoff_factor=2.0),
    timeout=TimeoutPolicy(run_timeout=120, idle_timeout=30),
    error_handler=lambda state, error: Command(
        update={"error": str(error.error)}, goto="error_handler"
    ),
)
```

That replaces the counter, the loop-back edge, the backoff, AND adds a timeout the manual pattern
never had. Details: `resilience-node-timeouts.md`, `resilience-error-handlers.md`.

## Manual Retry Loop (pre-1.2 fallback)

Loop-back edges for retrying failed operations. Always include a max retry counter.

**Incorrect:**
```python
def should_retry(state) -> str:
    if state.get("output"):
        return "success"
    return "retry"  # No max counter — infinite loop if LLM keeps failing

workflow.add_conditional_edges("llm_call", should_retry, {
    "success": "next_step",
    "retry": "llm_call",  # Loops forever
})
```

**Correct:**
```python
def llm_call_with_retry(state):
    try:
        result = call_llm(state["input"])
        return {"output": result, "retry_count": 0}
    except Exception as e:
        return {
            "retry_count": state.get("retry_count", 0) + 1,
            "error": str(e),
        }

def should_retry(state) -> str:
    if state.get("output"):
        return "success"
    elif state["retry_count"] < 3:
        return "retry"
    else:
        return "failed"  # Max retries exceeded

workflow.add_conditional_edges("llm_call", should_retry, {
    "success": "next_step",
    "retry": "llm_call",
    "failed": "error_handler",
})
```

**Key rules:**
- On 1.2+, reach for `retry_policy` / `timeout` / `error_handler` first — the manual loop is the fallback
- If you do hand-roll it: always track `retry_count` in state, and never omit the max
- Set max retries (2-3 for LLM calls)
- Include explicit "failed" path for max retries exceeded
- A manual loop has no timeout: a hung call never fails, so the counter never advances

Reference: [LangGraph Conditional Edges](https://langchain-ai.github.io/langgraph/concepts/low_level/#conditional-edges)
