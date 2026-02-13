---
title: "LLM: Cost Tracking"
impact: HIGH
impactDescription: "LLM costs can spike unexpectedly — cost tracking with spend alerts prevents budget overruns and enables per-operation cost attribution."
tags: [langfuse, cost, tokens, pricing, spend-alerts, metrics-api, budget]
---

# LLM Cost Tracking

## Basic Cost Tracking (Langfuse v3)

```python
from langfuse import observe, get_client

@observe(name="security_audit")
async def run_audit(content: str):
    response = await llm.generate(
        model="claude-sonnet-4-5-20250929",
        messages=[{"role": "user", "content": f"Analyze: {content}"}],
    )

    get_client().update_current_observation(
        model="claude-sonnet-4-5-20250929",
        usage={
            "input": 1500,
            "output": 1000,
            "unit": "TOKENS",
        },
    )
    # Langfuse auto-calculates: $0.0045 + $0.015 = $0.0195
    return response
```

## Custom Model Pricing

```python
from langfuse import Langfuse

langfuse = Langfuse()

langfuse.create_model(
    model_name="claude-sonnet-4-5-20250929",
    match_pattern="claude-sonnet-4.*",
    unit="TOKENS",
    input_price=0.000003,   # $3/MTok
    output_price=0.000015,  # $15/MTok
)
```

## Cost Per Analysis

```python
trace = langfuse.get_trace(trace_id)
total_cost = sum(
    gen.calculated_total_cost or 0
    for gen in trace.observations
    if gen.type == "GENERATION"
)

await analysis_repo.update(
    analysis_id,
    langfuse_trace_id=trace.id,
    total_cost_usd=total_cost,
)
```

## Spend Alerts

### Via Langfuse UI

1. Navigate to **Settings -> Alerts**
2. Create alert rule:
   - **Metric**: Daily cost
   - **Threshold**: $50/day
   - **Channel**: Slack / Email / Webhook

### Via Metrics API

```python
from langfuse import Langfuse
from datetime import datetime, timedelta

langfuse = Langfuse()

metrics = langfuse.get_metrics(
    metric_name="total_cost",
    from_timestamp=datetime.now() - timedelta(days=1),
    to_timestamp=datetime.now(),
)

daily_cost = metrics.values[0].value if metrics.values else 0

if daily_cost > 50.0:
    await send_alert(
        channel="slack",
        message=f"Daily LLM cost alert: ${daily_cost:.2f} exceeds $50 threshold",
    )
```

## v2 Metrics API Queries

```python
# Total cost over last 7 days
metrics = langfuse.get_metrics(
    metric_name="total_cost",
    from_timestamp=datetime.now() - timedelta(days=7),
    granularity="day",
)

# Token usage by model
token_metrics = langfuse.get_metrics(
    metric_name="total_tokens",
    from_timestamp=datetime.now() - timedelta(days=7),
    group_by="model",
)
```

## Prometheus LLM Cost Metrics

```python
from prometheus_client import Counter, Histogram

llm_tokens_used = Counter(
    'llm_tokens_used_total', 'Total LLM tokens',
    ['model', 'operation', 'token_type']
)
llm_cost_dollars = Counter(
    'llm_cost_dollars_total', 'Total LLM cost in dollars',
    ['model', 'operation']
)
llm_request_duration = Histogram(
    'llm_request_duration_seconds', 'LLM request duration',
    ['model', 'operation'], buckets=[0.5, 1, 2, 5, 10, 20, 30]
)
```

## Monitoring Dashboard SQL Queries

```sql
-- Top 10 most expensive traces (last 7 days)
SELECT name, user_id, calculated_total_cost, input_tokens, output_tokens
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
ORDER BY calculated_total_cost DESC LIMIT 10;

-- Average cost by agent type
SELECT metadata->>'agent_type' as agent, COUNT(*) as traces,
  AVG(calculated_total_cost) as avg_cost
FROM traces WHERE metadata->>'agent_type' IS NOT NULL
GROUP BY agent ORDER BY avg_cost DESC;

-- Daily cost trend
SELECT DATE(timestamp) as date, SUM(calculated_total_cost) as daily_cost
FROM traces WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp) ORDER BY date;
```

## Best Practices

1. **Always pass usage data** with input/output token counts
2. **Monitor costs daily** with spend alerts to catch spikes early
3. **Set threshold alerts** for abnormal increases (> 2x daily average)
4. **Track by user_id** to identify expensive users
5. **Group by metadata** (agent_type, operation) for cost attribution
6. **Use custom pricing** for self-hosted models
7. **Use Metrics API** for programmatic queries instead of raw SQL
