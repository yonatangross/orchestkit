---
title: OpenAI Automatic Prompt Caching
impact: HIGH
impactDescription: "OpenAI caches prompt prefixes automatically — no code changes needed, but understanding the mechanism enables better prompt structuring"
tags: openai, gpt, automatic, prefix-caching
---

## OpenAI Automatic Caching

OpenAI caches prompt prefixes automatically. No `cache_control` markers needed.

**Supported Models (2026):** gpt-5.2, gpt-5.2-mini, o3, o3-mini

```python
# OpenAI caches prefixes automatically
# No cache_control markers needed

response = await openai.chat.completions.create(
    model="gpt-5.2",
    messages=[
        {"role": "system", "content": system_prompt},  # Cached
        {"role": "user", "content": user_content}      # Not cached
    ]
)

# Check cache usage in response
cache_tokens = response.usage.prompt_tokens_cached
```

**Key differences from Claude:**
- No explicit cache breakpoints required
- Caching happens transparently on the server side
- Check `response.usage.prompt_tokens_cached` for cache hits
- Structure prompts with stable prefix first for optimal caching

**Key rules:**
- Keep system prompts and few-shot examples at the beginning of messages
- Avoid changing early message content between calls
- Monitor `prompt_tokens_cached` to verify caching is working
- No pricing penalty for cache writes (unlike Claude's 1.25x)
