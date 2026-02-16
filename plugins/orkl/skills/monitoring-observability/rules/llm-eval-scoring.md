---
title: "LLM: Evaluation Scoring"
impact: HIGH
impactDescription: "Systematic LLM evaluation scoring enables quality monitoring, regression detection, and data-driven prompt optimization."
tags: [langfuse, scoring, evaluation, g-eval, multi-judge, quality, datasets]
---

# LLM Evaluation Scoring

## Basic Scoring (Langfuse v3)

```python
from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()

@observe()
async def analyze_and_score(query: str):
    response = await llm.generate(query)

    # Score within @observe context
    get_client().score_current_trace(
        name="relevance",
        value=0.85,
        comment="Response addresses query but lacks depth",
    )
    return response

# Or score by trace_id directly
langfuse.score(
    trace_id="trace_123",
    name="factuality",
    value=0.92,
    data_type="NUMERIC",
)
```

## Score Types

```python
# Numeric scores (0-1 range)
langfuse.score(trace_id="...", name="relevance", value=0.85, data_type="NUMERIC")

# Categorical scores
langfuse.score(trace_id="...", name="sentiment", value="positive", data_type="CATEGORICAL")

# Boolean scores
langfuse.score(trace_id="...", name="contains_pii", value=0, data_type="BOOLEAN")
```

## Evaluator Execution Tracing

Each evaluator run creates its own inspectable trace:

```python
from langfuse import observe, get_client

@observe(type="evaluator", name="relevance_judge")
async def evaluate_relevance(query: str, response: str):
    score = await llm_judge.evaluate(
        criteria="relevance", query=query, response=response,
    )

    get_client().update_current_observation(
        input={"query": query[:500], "response": response[:500]},
        output={"score": score, "criteria": "relevance"},
        model="claude-sonnet-4-5-20250929",
    )
    return score
```

Result in Langfuse UI:
```
evaluator:relevance_judge (0.8s, $0.01)
+-- generation: judge_prompt -> score: 0.85
+-- metadata: {criteria: "relevance", model: "claude-sonnet-4-5"}
```

## G-Eval Automated Scoring

```python
from langfuse import observe, get_client

scorer = GEvalScorer()

@observe()
async def analyze_with_scoring(query: str):
    response = await llm.generate(query)

    scores = await scorer.score(
        query=query, response=response,
        criteria=["relevance", "coherence", "depth"],
    )

    for criterion, score in scores.items():
        get_client().score_current_trace(name=criterion, value=score)

    return response
```

## Common Evaluation Metrics

| Metric | Range | Description |
|--------|-------|-------------|
| **Relevance** | 0-1 | Does response address the query? |
| **Coherence** | 0-1 | Is response logically structured? |
| **Depth** | 0-1 | Level of detail and analysis |
| **Factuality** | 0-1 | Accuracy of claims |
| **Completeness** | 0-1 | All aspects of query covered? |
| **Toxicity** | 0-1 | Harmful or inappropriate content |

## Quality Gate Integration

```python
from langfuse import observe, get_client

@observe(name="quality_gate")
async def quality_gate_node(state):
    scores = await run_quality_evaluators(state)

    for criterion, score in scores.items():
        get_client().score_current_trace(name=criterion, value=score)

    avg_score = sum(scores.values()) / len(scores)
    return {"quality_gate_passed": avg_score >= 0.7, "quality_scores": scores}
```

## Score Trend Query

```sql
SELECT
    DATE(timestamp) as date,
    AVG(value) FILTER (WHERE name = 'relevance') as avg_relevance,
    AVG(value) FILTER (WHERE name = 'depth') as avg_depth,
    AVG(value) FILTER (WHERE name = 'factuality') as avg_factuality
FROM scores
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(timestamp)
ORDER BY date;
```

## Best Practices

1. **Score all production traces** for quality monitoring
2. **Use evaluator type** (`@observe(type="evaluator")`) for inspectable judge traces
3. **Use consistent criteria** across all evaluations
4. **Automate scoring** with G-Eval or similar frameworks
5. **Set quality thresholds** (e.g., avg_relevance > 0.7)
6. **Create test datasets** for regression testing
7. **Track scores by prompt version** to measure improvements
8. **Alert on quality drops** (e.g., avg_score < 0.6 for 3 consecutive days)

**Incorrect — no quality scoring in production:**
```python
@observe()
async def analyze(query: str):
    response = await llm.generate(query)
    return response  # No quality metrics
```

**Correct — automated quality scoring:**
```python
@observe()
async def analyze(query: str):
    response = await llm.generate(query)
    scores = await scorer.score(query, response, ["relevance", "depth"])
    for criterion, score in scores.items():
        get_client().score_current_trace(name=criterion, value=score)
    return response
```
