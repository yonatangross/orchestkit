# Retry Loop Pattern

Implement retry logic with backoff for failed operations.

## Implementation

```python
from langgraph.graph import StateGraph, END

async def llm_call_node(state: WorkflowState) -> dict:
    """LLM call with error capture."""
    try:
        result = await llm.ainvoke(state["input"])
        return {"output": result, "error": None, "retry_count": 0}
    except Exception as e:
        return {
            "error": str(e),
            "retry_count": state.get("retry_count", 0) + 1
        }

def should_retry(state: WorkflowState) -> str:
    """Decide: success, retry, or fail."""
    if state.get("output") and not state.get("error"):
        return "success"
    elif state.get("retry_count", 0) < 3:
        return "retry"
    else:
        return "failed"

workflow.add_conditional_edges(
    "llm_call",
    should_retry,
    {
        "success": "next_step",
        "retry": "llm_call",  # Loop back
        "failed": "error_handler"
    }
)
```

## When to Use

- Transient LLM API failures
- Rate limit recovery
- Network timeout handling
- Idempotent operations only

## Anti-patterns

- No max retry limit (infinite loops)
- Retrying non-idempotent operations
- No exponential backoff for rate limits
- Retrying permanent failures