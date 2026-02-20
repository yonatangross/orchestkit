---
title: Configure HyDE fallback strategy to avoid latency degradation from slow generation
impact: MEDIUM
impactDescription: "HyDE adds latency — without a fallback, slow generation degrades user experience"
tags: hyde, fallback, timeout, graceful-degradation
---

## HyDE Fallback Strategy

Implement graceful degradation when HyDE generation is too slow.

**Timeout with Fallback:**
```python
async def hyde_with_fallback(
    query: str,
    hyde_service: HyDEService,
    embed_fn: callable,
    timeout: float = 3.0,
) -> list[float]:
    """HyDE with fallback to direct embedding on timeout."""
    try:
        async with asyncio.timeout(timeout):
            result = await hyde_service.generate(query)
            return result.embedding
    except TimeoutError:
        # Fallback to direct query embedding
        return await embed_fn(query)
```

**Performance Tips:**
- Use fast model (gpt-5.2-mini, claude-haiku-4-5) for generation
- Cache aggressively (queries often repeat)
- Set tight timeouts (2-3s) with fallback
- Keep hypothetical docs concise (100-200 tokens)
- Combine with query decomposition for best results

**Incorrect — no timeout or fallback, blocking forever:**
```python
async def hyde_search(query: str) -> list[float]:
    # No timeout! May hang indefinitely
    result = await hyde_service.generate(query)
    return result.embedding
```

**Correct — timeout with graceful fallback:**
```python
async def hyde_with_fallback(query: str, timeout: float = 3.0) -> list[float]:
    try:
        async with asyncio.timeout(timeout):
            result = await hyde_service.generate(query)
            return result.embedding
    except TimeoutError:
        # Fallback to direct query embedding
        return await embed_fn(query)
```

**Key rules:**
- Always implement timeout fallback — HyDE generation model may be slow or unavailable
- Default timeout: 2-3 seconds is the sweet spot (balances quality vs latency)
- Fallback to direct query embedding maintains functionality (just lower quality)
- Log fallback events to monitor HyDE generation reliability
