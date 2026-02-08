# Session & User Tracking

Group related traces, track performance by user, and filter with natural language.

## Session Tracking (v3)

Group related traces into user sessions using `get_client()`:

```python
from langfuse import observe, get_client

@observe(name="url_fetch")
async def fetch_url(url: str, session_id: str):
    get_client().update_current_trace(session_id=session_id)
    return await http.get(url)

@observe(name="content_analysis")
async def analyze(content: str, session_id: str):
    get_client().update_current_trace(session_id=session_id)
    return await run_agents(content)

@observe(name="quality_gate")
async def quality_check(result: str, session_id: str):
    get_client().update_current_trace(session_id=session_id)
    return await evaluate(result)


# Usage — all 3 traces grouped under one session
session_id = f"analysis_{analysis_id}"
url_content = await fetch_url(url, session_id)
result = await analyze(url_content, session_id)
final = await quality_check(result, session_id)
```

## Session View in UI

```
Session: analysis_abc123 (15.2s, $0.23)
├── url_fetch (1.0s, $0.02)
├── content_analysis (12.5s, $0.18)
│   ├── retrieval (0.5s, $0.01)
│   ├── security_audit (3.0s, $0.05)
│   ├── tech_comparison (2.5s, $0.04)
│   └── implementation_plan (6.5s, $0.08)
└── quality_gate (1.7s, $0.03)
```

## User Tracking

Track performance per user:

```python
from langfuse import observe, get_client

@observe()
async def analysis(content: str, user_id: str):
    get_client().update_current_trace(
        user_id=user_id,
        session_id="session_abc",
        metadata={
            "content_type": "article",
            "url": "https://example.com/post",
            "analysis_id": "abc123",
        },
    )
    return await run_pipeline(content)
```

## Natural Language Filtering

Langfuse v3 supports natural language queries to filter traces in the UI:

```
# Examples of natural language filters:
"show me traces with latency > 5s from yesterday"
"find all traces by user_123 with cost > $0.10"
"traces tagged 'production' with relevance score < 0.5"
"sessions with more than 3 traces in the last 24 hours"
```

This replaces manual filter construction for common queries.

## Metadata Tracking

Track custom metadata for filtering and analytics:

```python
from langfuse import observe, get_client

@observe()
async def analysis(content: str):
    get_client().update_current_trace(
        user_id="user_123",
        metadata={
            "content_type": "article",
            "url": "https://example.com/post",
            "analysis_id": "abc123",
            "agent_count": 8,
            "total_cost_usd": 0.15,
            "difficulty": "complex",
            "language": "en",
        },
        tags=["production", "orchestkit", "security"],
    )
    return await run_pipeline(content)
```

## Analytics Queries

### Performance by User

```sql
SELECT
    user_id,
    COUNT(*) as trace_count,
    AVG(latency_ms) as avg_latency,
    SUM(calculated_total_cost) as total_cost
FROM traces
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_cost DESC
LIMIT 10;
```

### v2 Metrics API Alternative

```python
from langfuse import Langfuse
from datetime import datetime, timedelta

langfuse = Langfuse()

# Query session metrics via Metrics API instead of SQL
metrics = langfuse.get_metrics(
    metric_name="trace_count",
    from_timestamp=datetime.now() - timedelta(days=7),
    to_timestamp=datetime.now(),
    group_by="user_id",
    granularity="day",
)

for group in metrics.groups:
    print(f"User {group.key}: {group.values[0].value} traces")
```

### Performance by Content Type

```sql
SELECT
    metadata->>'content_type' as content_type,
    COUNT(*) as count,
    AVG(latency_ms) as avg_latency,
    AVG(calculated_total_cost) as avg_cost
FROM traces
WHERE metadata->>'content_type' IS NOT NULL
GROUP BY content_type
ORDER BY count DESC;
```

### Slowest Sessions

```sql
SELECT
    session_id,
    COUNT(*) as trace_count,
    SUM(latency_ms) as total_latency,
    SUM(calculated_total_cost) as total_cost
FROM traces
WHERE session_id IS NOT NULL
    AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY session_id
ORDER BY total_latency DESC
LIMIT 10;
```

## Tags for Filtering

Use tags for environment and feature flags:

```python
from langfuse import observe, get_client

@observe()
async def production_analysis(content: str):
    get_client().update_current_trace(
        tags=["production", "v2-pipeline", "security-enabled"],
    )
    return await run_pipeline(content)

@observe()
async def staging_analysis(content: str):
    get_client().update_current_trace(
        tags=["staging", "experiment", "new-model"],
    )
    return await run_pipeline(content)
```

## Best Practices

1. **Always set session_id** for multi-step workflows
2. **Always set user_id** for user attribution
3. **Add meaningful metadata** (content_type, analysis_id, difficulty)
4. **Use consistent tag names** across environments
5. **Tag production vs staging** traces
6. **Use natural language filtering** for quick trace lookups
7. **Track business metrics** in metadata (conversion, revenue, user_tier)
8. **Filter by tags** in dashboards for environment-specific views

## OrchestKit Session Pattern

```python
from langfuse import observe, get_client

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str, user_id: str):
    """Full workflow with session tracking."""

    # Set session-level metadata
    get_client().update_current_trace(
        session_id=f"analysis_{analysis_id}",
        user_id=user_id,
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content),
            "agent_count": 8,
            "environment": "production",
        },
        tags=["orchestkit", "production", "content-analysis"],
    )

    # All nested @observe calls inherit session_id
    results = []
    for agent in agents:
        result = await execute_agent(agent, content)
        results.append(result)

    return results
```

## Identifying Slow or Expensive Users

```sql
-- Users with highest average latency
SELECT
    user_id,
    COUNT(*) as sessions,
    AVG(total_latency) as avg_session_latency,
    AVG(total_cost) as avg_session_cost
FROM (
    SELECT
        user_id,
        session_id,
        SUM(latency_ms) as total_latency,
        SUM(calculated_total_cost) as total_cost
    FROM traces
    WHERE timestamp > NOW() - INTERVAL '7 days'
    GROUP BY user_id, session_id
) sessions
GROUP BY user_id
HAVING COUNT(*) >= 5  -- At least 5 sessions
ORDER BY avg_session_latency DESC
LIMIT 10;
```

## References

- [Langfuse Sessions](https://langfuse.com/docs/tracing-features/sessions)
- [User Tracking](https://langfuse.com/docs/tracing-features/users)
- [Tags & Metadata](https://langfuse.com/docs/tracing)
- [Natural Language Filtering](https://langfuse.com/docs/tracing-features/filtering)
