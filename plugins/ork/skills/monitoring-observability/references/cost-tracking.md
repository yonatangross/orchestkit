# Token & Cost Tracking

Automatic cost calculation based on model pricing, with spend alerts and Metrics API.

## Basic Cost Tracking (v3)

```python
from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()

@observe(name="security_audit")
async def run_audit(content: str):
    """Track costs automatically via @observe."""
    response = await llm.generate(
        model="claude-sonnet-4-6",
        messages=[{"role": "user", "content": f"Analyze for XSS: {content}"}],
    )

    get_client().update_current_observation(
        model="claude-sonnet-4-6",
        usage={
            "input": 1500,
            "output": 1000,
            "unit": "TOKENS",
        },
    )
    # Langfuse automatically calculates: $0.0045 + $0.015 = $0.0195
    return response
```

## Pricing Database (Auto-Updated)

Langfuse maintains a pricing database for all major models. You can also define custom pricing:

```python
langfuse = Langfuse()

# Custom model pricing
langfuse.create_model(
    model_name="claude-sonnet-4-6",
    match_pattern="claude-sonnet-4.*",
    unit="TOKENS",
    input_price=0.000003,  # $3/MTok
    output_price=0.000015,  # $15/MTok
    total_price=None,  # Calculated from input+output
)
```

## Cost Tracking Per Analysis

```python
from langfuse import Langfuse

langfuse = Langfuse()

# After analysis completes
trace = langfuse.get_trace(trace_id)
total_cost = sum(
    gen.calculated_total_cost or 0
    for gen in trace.observations
    if gen.type == "GENERATION"
)

# Store in database
await analysis_repo.update(
    analysis_id,
    langfuse_trace_id=trace.id,
    total_cost_usd=total_cost,
)
```

## Spend Alerts

Configure alerts to get notified when costs exceed thresholds:

### In Langfuse UI

1. Navigate to **Settings → Alerts**
2. Create alert rule:
   - **Metric**: Daily cost
   - **Threshold**: $50/day
   - **Channel**: Slack / Email / Webhook

### Via API

```python
langfuse = Langfuse()

# Programmatic spend check
from datetime import datetime, timedelta

# Get daily cost via v2 Metrics API
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

## v2 Metrics API (Beta)

Query cost and usage metrics programmatically instead of SQL:

```python
from langfuse import Langfuse
from datetime import datetime, timedelta

langfuse = Langfuse()

# Total cost over last 7 days
metrics = langfuse.get_metrics(
    metric_name="total_cost",
    from_timestamp=datetime.now() - timedelta(days=7),
    to_timestamp=datetime.now(),
    granularity="day",
)

for point in metrics.values:
    print(f"{point.timestamp.date()}: ${point.value:.2f}")

# Token usage by model
token_metrics = langfuse.get_metrics(
    metric_name="total_tokens",
    from_timestamp=datetime.now() - timedelta(days=7),
    to_timestamp=datetime.now(),
    group_by="model",
)

for group in token_metrics.groups:
    print(f"{group.key}: {group.values[0].value:,} tokens")
```

## Monitoring Dashboard Queries

### Top 10 Most Expensive Traces (Last 7 Days)

```sql
SELECT
    name,
    user_id,
    calculated_total_cost,
    input_tokens,
    output_tokens
FROM traces
WHERE timestamp > NOW() - INTERVAL '7 days'
ORDER BY calculated_total_cost DESC
LIMIT 10;
```

### Average Cost by Agent Type

```sql
SELECT
    metadata->>'agent_type' as agent,
    COUNT(*) as traces,
    AVG(calculated_total_cost) as avg_cost,
    SUM(calculated_total_cost) as total_cost
FROM traces
WHERE metadata->>'agent_type' IS NOT NULL
GROUP BY agent
ORDER BY total_cost DESC;
```

### Daily Cost Trend

```sql
SELECT
    DATE(timestamp) as date,
    SUM(calculated_total_cost) as daily_cost,
    COUNT(*) as trace_count
FROM traces
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

## Best Practices

1. **Always pass usage data** with input/output token counts
2. **Monitor costs daily** with spend alerts to catch spikes early
3. **Set up threshold alerts** for abnormal cost increases (> 2x daily average)
4. **Track costs by user_id** to identify expensive users
5. **Group by metadata** (content_type, agent_type) for cost attribution
6. **Use custom pricing** for self-hosted models
7. **Use Metrics API** for programmatic cost queries instead of raw SQL

## References

- [Langfuse Model Pricing](https://langfuse.com/docs/model-usage-and-cost)
- [Metrics API](https://langfuse.com/docs/analytics/metrics-api)
- [Spend Alerts](https://langfuse.com/docs/analytics/alerts)
