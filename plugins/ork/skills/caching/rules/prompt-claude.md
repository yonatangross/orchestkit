---
title: Claude Prompt Caching
impact: HIGH
impactDescription: "Claude prompt caching reduces repeated prefix costs by 90% — essential for any application making multiple calls with shared system prompts"
tags: claude, anthropic, cache_control, ephemeral, TTL
---

## Claude Prompt Caching

Cache stable prompt prefixes for 90% cost reduction on subsequent requests.

**Supported Models (2026):** Opus 4.1, Opus 4, Sonnet 4.5, Sonnet 4, Sonnet 3.7, Haiku 4.5, Haiku 3.5, Haiku 3

```python
def build_cached_messages(
    system_prompt: str,
    few_shot_examples: str | None,
    user_content: str,
    use_extended_cache: bool = False
) -> list[dict]:
    """Build messages with cache breakpoints.

    Cache structure (processing order: tools -> system -> messages):
    1. System prompt (cached)
    2. Few-shot examples (cached)
    --------- CACHE BREAKPOINT ---------
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

## Extended Cache (1-Hour TTL)

Use 1-hour cache when:
- Prompt reused > 10 times per hour
- System prompts are highly stable
- Token count > 10k (maximize savings)

```python
# Extended cache: 2x write cost but persists 12x longer
"cache_control": {"type": "ephemeral", "ttl": "1h"}

# Break-even: 1h cache pays off after ~8 reads
# (2x write cost / 0.9 savings per read ~ 8 reads)
```

## Cache Pricing

```
Cache Cost Multipliers (relative to base input price):
  5-minute cache write:  1.25x base input price
  1-hour cache write:    2.00x base input price
  Cache read:            0.10x base input price (90% off!)

Example: Claude Sonnet 4 @ $3/MTok input

Without Prompt Caching:
  17,000 tokens @ $3/MTok = $0.051

With 5m Caching (cache read):
  7,000 cached @ $0.30/MTok + 10,000 uncached @ $3/MTok = $0.0321

Savings: 37% per cached request, break-even after 2 requests
```

**Key rules:**
- Place stable content (system prompt, examples) before dynamic content
- Minimum prefix size: 1,024 tokens
- Maximum 4 cache breakpoints per request
- Default to 5m TTL; use 1h only if >10 reads/hour
