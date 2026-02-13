---
title: Cache Effectiveness and ROI Metrics
impact: MEDIUM
impactDescription: "Measuring cache hit rate and cost savings is essential for justifying caching infrastructure and tuning threshold parameters"
tags: effectiveness, hit-rate, ROI, metrics, cost-savings
---

## Cache Effectiveness

```python
cache_hits = 0
cache_misses = 0
cost_saved = 0.0

for gen in generations:
    if gen.metadata.get("cache_hit"):
        cache_hits += 1
        cost_saved += estimate_full_cost(gen)
    else:
        cache_misses += 1

hit_rate = cache_hits / (cache_hits + cache_misses)
print(f"Cache Hit Rate: {hit_rate:.1%}")
print(f"Cost Saved: ${cost_saved:.2f}")
```

## Key Metrics

| Metric | Formula | Target |
|--------|---------|--------|
| Hit Rate | hits / (hits + misses) | > 60% after warm-up |
| Cost Saved | sum(estimated_cost per hit) | Track weekly |
| Latency Reduction | avg(L4 latency) - avg(L1/L2 latency) | > 90% |
| ROI | cost_saved / cache_infrastructure_cost | > 5x |

## Monitoring with Langfuse

Track these in the Langfuse dashboard:
- Filter by `metadata.cache_hit = true` for hit analysis
- Group by `metadata.cache_layer` for per-level metrics
- Use `metadata.agent_type` for per-agent cache effectiveness
- Compare `cache_read_input_tokens` vs `input_tokens` for prompt cache ROI

## Key Decisions

| Decision | Recommendation |
|----------|----------------|
| Trace grouping | session_id = analysis_id |
| Cost attribution | metadata.agent_type |
| Query window | 7-30 days |
| Dashboard | Langfuse web UI |

**Key rules:**
- Track hit rate per cache level (L1, L2, L3) separately
- Monitor cost savings weekly to justify infrastructure
- Alert when hit rate drops below baseline (threshold may need tuning)
- Cache warming from golden datasets accelerates ROI
