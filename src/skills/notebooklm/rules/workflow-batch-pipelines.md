---
title: "Batch Operations & Pipelines"
impact: HIGH
impactDescription: "Cross-notebook queries and pipelines enable multi-project synthesis but add latency if misused"
tags: [batch, pipelines, cross-notebook, multi-project]
---

## Batch Operations & Pipelines

v0.4.6+ adds batch operations across multiple notebooks, cross-notebook queries with aggregated answers, and multi-step pipelines. Use for multi-project synthesis — not single-notebook tasks.

**Incorrect — querying notebooks one at a time for synthesis:**
```
# Slow: sequential queries across 5 notebooks
for nb_id in notebook_ids:
    result = notebook_query(notebook_id=nb_id, query="What are the security risks?")
    results.append(result)
# Manual aggregation required
```

**Correct — cross-notebook query for aggregated answers:**
```
# Single call: queries all notebooks, returns aggregated answer with per-notebook citations
result = cross_notebook_query(
    notebook_ids=["nb1", "nb2", "nb3"],
    query="What are the security risks across all projects?"
)
# result includes: aggregated_answer, per_notebook_citations[]
```

**Batch operations — multi-notebook bulk actions:**
```
# Add the same source to multiple notebooks at once
batch(
    action="add-source",
    notebook_ids=["nb1", "nb2", "nb3"],
    source_type="url",
    url="https://owasp.org/Top10/"
)

# Create studio content across notebooks
batch(
    action="studio",
    notebook_ids=["nb1", "nb2"],
    artifact_type="audio",
    audio_format="brief",
    language="he",
    confirm=True
)
```

**Pipelines — multi-step workflows in a single call:**
```
# Ingest sources and immediately generate a podcast
pipelines(
    pipeline="ingest-and-podcast",
    notebook_id="...",
    sources=[{"type": "url", "url": "https://example.com/article"}],
    audio_format="deep_dive",
    language="en",
    confirm=True
)

# Research a topic, add findings, generate a report
pipelines(
    pipeline="research-and-report",
    notebook_id="...",
    query="Latest trends in LLM safety",
    report_format="Briefing Doc",
    confirm=True
)

# Generate multiple artifact types from the same sources
pipelines(
    pipeline="multi-format",
    notebook_id="...",
    artifact_types=["audio", "infographic", "mind_map"],
    language="he",
    confirm=True
)
```

**Tagging notebooks for organization:**
```
# Tag notebooks for smart filtering
tags(notebook_id="...", action="add", tags=["security", "q1-2026"])

# Use tags to select notebooks for batch operations
batch(
    action="query",
    tag_filter="security",
    query="What vulnerabilities were identified?"
)
```

**Key rules:**
- Use `cross_notebook_query` for synthesis across projects — avoids sequential query overhead
- `batch` operations run in parallel server-side — faster than sequential MCP calls
- Pipelines combine ingest + generation — use when source addition and content creation are a single intent
- Tag notebooks early — enables tag-based batch operations later
- All batch/pipeline operations support the `language` parameter for multilingual output
- `confirm=True` is required on destructive or generative batch actions
