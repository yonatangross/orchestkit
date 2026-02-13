---
title: Langfuse Automatic Cost Tracking
impact: MEDIUM
impactDescription: "Langfuse @observe decorator provides zero-effort cost tracking for LLM calls — essential for understanding cache ROI and per-agent cost attribution"
tags: langfuse, observe, cost, tracking, metadata
---

## Langfuse Automatic Tracking

```python
from langfuse.decorators import observe, langfuse_context

@observe(as_type="generation")
async def call_llm_with_cache(
    prompt: str,
    agent_type: str,
    analysis_id: UUID
) -> str:
    """LLM call with automatic cost tracking."""

    # Link to parent trace
    langfuse_context.update_current_trace(
        name=f"{agent_type}_generation",
        session_id=str(analysis_id)
    )

    # Check caches
    if cache_key in lru_cache:
        langfuse_context.update_current_observation(
            metadata={"cache_layer": "L1", "cache_hit": True}
        )
        return lru_cache[cache_key]

    similar = await semantic_cache.get(prompt, agent_type)
    if similar:
        langfuse_context.update_current_observation(
            metadata={"cache_layer": "L2", "cache_hit": True}
        )
        return similar

    # LLM call - Langfuse tracks tokens/cost automatically
    response = await llm.generate(prompt)

    langfuse_context.update_current_observation(
        metadata={
            "cache_layer": "L4",
            "cache_hit": False,
            "prompt_cache_hit": response.usage.cache_read_input_tokens > 0
        }
    )

    return response.content
```

**Key rules:**
- Use `@observe(as_type="generation")` for LLM calls
- Always set `session_id` for trace grouping
- Record `cache_layer` and `cache_hit` in metadata
- Track `prompt_cache_hit` separately from semantic cache hits
- Langfuse auto-tracks token counts and costs for supported models
