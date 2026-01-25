# Session & User Tracking

Group related traces and track performance by user.

## Session Tracking

Group related traces into user sessions:

```python
# Start session
session_id = f"analysis_{analysis_id}"

# All traces with same session_id are grouped
trace1 = langfuse.trace(
    name="url_fetch",
    session_id=session_id
)

trace2 = langfuse.trace(
    name="content_analysis",
    session_id=session_id
)

trace3 = langfuse.trace(
    name="quality_gate",
    session_id=session_id
)

# View in UI: All 3 traces grouped under session
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
langfuse.trace(
    name="analysis",
    user_id="user_123",
    session_id="session_abc",
    metadata={
        "content_type": "article",
        "url": "https://example.com/post",
        "analysis_id": "abc123"
    }
)
```

## Metadata Tracking

Track custom metadata for filtering and analytics:

```python
langfuse.trace(
    name="analysis",
    user_id="user_123",
    metadata={
        "content_type": "article",
        "url": "https://example.com/post",
        "analysis_id": "abc123",
        "agent_count": 8,
        "total_cost_usd": 0.15,
        "difficulty": "complex",
        "language": "en"
    },
    tags=["production", "orchestkit", "security"]
)
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
# Production traces
langfuse.trace(
    name="analysis",
    tags=["production", "v2-pipeline", "security-enabled"]
)

# Staging traces
langfuse.trace(
    name="analysis",
    tags=["staging", "experiment", "new-model"]
)

# Development traces
langfuse.trace(
    name="analysis",
    tags=["dev", "local", "debugging"]
)
```

## Best Practices

1. **Always set session_id** for multi-step workflows
2. **Always set user_id** for user attribution
3. **Add meaningful metadata** (content_type, analysis_id, difficulty)
4. **Use consistent tag names** across environments
5. **Tag production vs staging** traces
6. **Track business metrics** in metadata (conversion, revenue, user_tier)
7. **Filter by tags** in dashboards for environment-specific views

## OrchestKit Session Pattern

```python
# backend/app/workflows/content_analysis.py
from langfuse.decorators import observe, langfuse_context

@observe(name="content_analysis_workflow")
async def run_content_analysis(analysis_id: str, content: str, user_id: str):
    """Full workflow with session tracking."""

    # Set session-level metadata
    langfuse_context.update_current_trace(
        session_id=f"analysis_{analysis_id}",
        user_id=user_id,
        metadata={
            "analysis_id": analysis_id,
            "content_length": len(content),
            "agent_count": 8,
            "environment": "production"
        },
        tags=["orchestkit", "production", "content-analysis"]
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
