---
name: prompt-caching
description: Provider-native prompt caching for Claude and OpenAI. Use when optimizing LLM costs with cache breakpoints, caching system prompts, or reducing token costs for repeated prefixes.
tags: [llm, caching, cost-optimization, anthropic]
context: fork
agent: llm-integrator
version: 1.0.0
author: OrchestKit
user-invocable: false
---

# Prompt Caching

Cache LLM prompt prefixes for 90% token savings.

## Supported Models (2026)

| Provider | Models |
|----------|--------|
| Claude | Opus 4.1, Opus 4, Sonnet 4.5, Sonnet 4, Sonnet 3.7, Haiku 4.5, Haiku 3.5, Haiku 3 |
| OpenAI | gpt-4o, gpt-4o-mini, o1, o1-mini (automatic caching) |

## Claude Prompt Caching

```python
def build_cached_messages(
    system_prompt: str,
    few_shot_examples: str | None,
    user_content: str,
    use_extended_cache: bool = False
) -> list[dict]:
    """Build messages with cache breakpoints.

    Cache structure (processing order: tools → system → messages):
    1. System prompt (cached)
    2. Few-shot examples (cached)
    ─────── CACHE BREAKPOINT ───────
    3. User content (NOT cached)
    """
    # TTL: "5m" (default, 1.25x write cost) or "1h" (extended, 2x write cost)
    ttl = "1h" if use_extended_cache else "5m"

    content_parts = []

    # Breakpoint 1: System prompt
    content_parts.append({
        "type": "text",
        "text": system_prompt,
        "cache_control": {"type": "ephemeral", "ttl": ttl}
    })

    # Breakpoint 2: Few-shot examples (up to 4 breakpoints allowed)
    if few_shot_examples:
        content_parts.append({
            "type": "text",
            "text": few_shot_examples,
            "cache_control": {"type": "ephemeral", "ttl": ttl}
        })

    # Dynamic content (NOT cached)
    content_parts.append({
        "type": "text",
        "text": user_content
    })

    return [{"role": "user", "content": content_parts}]
```

## Cache Pricing (2026)

```
┌─────────────────────────────────────────────────────────────┐
│  Cache Cost Multipliers (relative to base input price)      │
├─────────────────────────────────────────────────────────────┤
│  5-minute cache write:  1.25x base input price              │
│  1-hour cache write:    2.00x base input price              │
│  Cache read:            0.10x base input price (90% off!)   │
└─────────────────────────────────────────────────────────────┘

Example: Claude Sonnet 4 @ $3/MTok input

Without Prompt Caching:
System prompt:     2,000 tokens @ $3/MTok  = $0.006
Few-shot examples: 5,000 tokens @ $3/MTok  = $0.015
User content:     10,000 tokens @ $3/MTok  = $0.030
───────────────────────────────────────────────────
Total:            17,000 tokens            = $0.051

With 5m Caching (first request = cache write):
Cached prefix:     7,000 tokens @ $3.75/MTok = $0.02625 (1.25x)
User content:     10,000 tokens @ $3/MTok    = $0.03000
Total first req:                             = $0.05625

With 5m Caching (subsequent = cache read):
Cached prefix:     7,000 tokens @ $0.30/MTok = $0.0021 (0.1x)
User content:     10,000 tokens @ $3/MTok    = $0.0300
Total cached req:                            = $0.0321

Savings: 37% per cached request, break-even after 2 requests
```

## Extended Cache (1-hour TTL)

Use 1-hour cache when:
- Prompt reused > 10 times per hour
- System prompts are highly stable
- Token count > 10k (maximize savings)

```python
# Extended cache: 2x write cost but persists 12x longer
"cache_control": {"type": "ephemeral", "ttl": "1h"}

# Break-even: 1h cache pays off after ~8 reads
# (2x write cost ÷ 0.9 savings per read ≈ 8 reads)
```

## OpenAI Automatic Caching

```python
# OpenAI caches prefixes automatically
# No cache_control markers needed

response = await openai.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_prompt},  # Cached
        {"role": "user", "content": user_content}      # Not cached
    ]
)

# Check cache usage in response
cache_tokens = response.usage.prompt_tokens_cached
```

## Cache Processing Order

```
Cache references entire prompt in order:
1. Tools (cached first)
2. System messages (cached second)
3. User messages (cached last)

⚠️ Extended thinking changes invalidate message caches
   (but NOT system/tools caches)
```

## Monitoring Cache Effectiveness

```python
# Track these fields in API response
response = await client.messages.create(...)

cache_created = response.usage.cache_creation_input_tokens  # New cache
cache_read = response.usage.cache_read_input_tokens         # Cache hit
regular = response.usage.input_tokens                        # Not cached

# Calculate cache hit rate
if cache_created + cache_read > 0:
    hit_rate = cache_read / (cache_created + cache_read)
    print(f"Cache hit rate: {hit_rate:.1%}")
```

## Best Practices

```python
# ✅ Good: Long, stable prefix first
messages = [
    {"role": "system", "content": LONG_SYSTEM_PROMPT},
    {"role": "user", "content": FEW_SHOT_EXAMPLES},
    {"role": "user", "content": user_input}  # Variable
]

# ❌ Bad: Variable content early (breaks cache)
messages = [
    {"role": "user", "content": user_input},  # Breaks cache!
    {"role": "system", "content": LONG_SYSTEM_PROMPT}
]
```

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Min prefix size | 1,024 tokens (Claude) |
| Breakpoint count | 2-4 per request |
| Content order | Stable prefix first |
| Default TTL | 5m for most cases |
| Extended TTL | 1h if >10 reads/hour |

## Common Mistakes

- Variable content before cached prefix
- Too many breakpoints (overhead)
- Prefix too short (min 1024 tokens)
- Not checking `cache_read_input_tokens`
- Using 1h TTL for infrequent calls (wastes 2x write)

## Related Skills

- `semantic-caching` - Redis similarity caching
- `cache-cost-tracking` - Cost monitoring
- `llm-streaming` - Streaming with caching

## Capability Details

### anthropic-caching
**Keywords:** anthropic, claude, cache_control, ephemeral
**Solves:**
- Use Anthropic prompt caching
- Set cache breakpoints
- Reduce API costs

### openai-caching
**Keywords:** openai, gpt, cached_tokens, automatic
**Solves:**
- Use OpenAI prompt caching
- Structure prompts for cache hits
- Monitor cache effectiveness

### wrapper-template
**Keywords:** wrapper, template, implementation, python
**Solves:**
- Prompt cache wrapper template
- Python implementation
- Drop-in caching layer
