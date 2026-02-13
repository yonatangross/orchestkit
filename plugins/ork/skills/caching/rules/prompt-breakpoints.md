---
title: Cache Processing Order and Breakpoint Strategies
impact: HIGH
impactDescription: "Understanding cache processing order and breakpoint placement is critical for achieving consistent cache hits and maximum cost savings"
tags: breakpoints, processing-order, monitoring, best-practices
---

## Cache Processing Order

```
Cache references entire prompt in order:
1. Tools (cached first)
2. System messages (cached second)
3. User messages (cached last)

Warning: Extended thinking changes invalidate message caches
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
# Good: Long, stable prefix first
messages = [
    {"role": "system", "content": LONG_SYSTEM_PROMPT},
    {"role": "user", "content": FEW_SHOT_EXAMPLES},
    {"role": "user", "content": user_input}  # Variable
]

# Bad: Variable content early (breaks cache)
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
- Using 1h TTL for infrequent calls (wastes 2x write cost)
