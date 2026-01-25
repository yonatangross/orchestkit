# Token & Cost Tracking

Automatic cost calculation based on model pricing.

## Basic Cost Tracking

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create trace with cost tracking
trace = langfuse.trace(
    name="content_analysis",
    user_id="user_123",
    session_id="session_abc"
)

# Log generation with automatic cost calculation
generation = trace.generation(
    name="security_audit",
    model="claude-sonnet-4-20250514",
    model_parameters={"temperature": 1.0, "max_tokens": 4096},
    input=[{"role": "user", "content": "Analyze for XSS..."}],
    output="Analysis: Found 3 vulnerabilities...",
    usage={
        "input": 1500,
        "output": 1000,
        "unit": "TOKENS"
    }
)

# Langfuse automatically calculates: $0.0045 + $0.015 = $0.0195
```

## Pricing Database (Auto-Updated)

Langfuse maintains a pricing database for all major models. You can also define custom pricing:

```python
# Custom model pricing
langfuse.create_model(
    model_name="claude-sonnet-4-20250514",
    match_pattern="claude-sonnet-4.*",
    unit="TOKENS",
    input_price=0.000003,  # $3/MTok
    output_price=0.000015,  # $15/MTok
    total_price=None  # Calculated from input+output
)
```

## Cost Tracking Per Analysis

```python
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
    total_cost_usd=total_cost
)
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
2. **Monitor costs daily** to catch spikes early
3. **Set up alerts** for abnormal cost increases (> 2x daily average)
4. **Track costs by user_id** to identify expensive users
5. **Group by metadata** (content_type, agent_type) for cost attribution
6. **Use custom pricing** for self-hosted models

## References

- [Langfuse Model Pricing](https://langfuse.com/docs/model-usage-and-cost)
- [Cost Tracking Guide](https://langfuse.com/docs/scores-and-evaluation/model-based-evaluation#cost-tracking)
