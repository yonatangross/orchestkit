---
title: HTTP & Prompt Caching
impact: HIGH
impactDescription: "LLM prompt caching can save 90% on token costs — incorrect breakpoint ordering wastes the entire cache prefix"
tags: http-cache, prompt-caching, cache-control, claude, openai, semantic-cache
---

## HTTP & Prompt Caching

HTTP cache headers for CDN/browser caching and LLM prompt caching for 90% token savings.

**Incorrect — variable content before cached prefix:**
```python
# WRONG: Variable content before static content breaks prompt cache
messages = [
    {"role": "user", "content": f"User {user_id} asks: {question}"},  # Variable first!
    {"role": "system", "content": long_system_prompt},  # Static content after = never cached
]
```

**Correct — static prefix first, then variable content:**
```python
# Claude prompt caching: static content first with cache_control
response = await client.messages.create(
    model="claude-sonnet-4-5-20250514",
    system=[
        {
            "type": "text",
            "text": long_system_prompt,  # Static: cached across calls
            "cache_control": {"type": "ephemeral"},  # 5-minute TTL
        },
    ],
    messages=[
        {"role": "user", "content": user_question},  # Variable: after cache breakpoint
    ],
)
# Result: ~90% token savings on system prompt after first call

# OpenAI: automatic prefix caching (no markers needed)
# Just ensure static content comes first in messages array
response = await openai.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": long_system_prompt},  # Cached automatically
        {"role": "user", "content": user_question},
    ],
)
```

**HTTP cache headers for API responses:**
```python
from fastapi import FastAPI, Response

app = FastAPI()

@app.get("/api/products/{product_id}")
async def get_product(product_id: str, response: Response):
    product = await fetch_product(product_id)
    # Browser caches 60s, CDN caches 1h
    response.headers["Cache-Control"] = "public, max-age=60, s-maxage=3600"
    response.headers["CDN-Cache-Control"] = "max-age=3600"
    return product

@app.get("/api/user/profile")
async def get_profile(response: Response):
    # Private: only browser cache, not CDN
    response.headers["Cache-Control"] = "private, max-age=300"
    return await get_current_user_profile()
```

**Key rules:**
- Claude: use `cache_control` with `ephemeral` type (5min default, 1h if >10 reads/hour)
- OpenAI: automatic prefix caching, no markers needed — just put static content first
- HTTP: `public, max-age=60, stale-while-revalidate=300` for API responses
- Use `s-maxage` or `CDN-Cache-Control` for different CDN vs browser TTLs
- Semantic caching: start threshold at 0.92, tune based on hit rate
- Never cache error responses or authentication tokens
