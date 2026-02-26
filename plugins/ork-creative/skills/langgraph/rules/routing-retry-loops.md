---
title: Implement retry loops with max counter to prevent infinite resource consumption
impact: HIGH
impactDescription: "No max retry counter creates infinite loops that consume resources forever"
tags: routing, retry, loop, error-handling
---

## Retry Loop Pattern

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
- Always track `retry_count` in state
- Set max retries (2-3 for LLM calls)
- Include explicit "failed" path for max retries exceeded
- Consider exponential backoff for API calls

Reference: [LangGraph Conditional Edges](https://langchain-ai.github.io/langgraph/concepts/low_level/#conditional-edges)
