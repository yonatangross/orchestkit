# LLM Evaluation & Scoring

Track quality metrics with custom scores and automated evaluation.

## Basic Scoring

```python
from langfuse import Langfuse

langfuse = Langfuse()

# Create trace
trace = langfuse.trace(name="content_analysis", id="trace_123")

# After LLM response, score it
trace.score(
    name="relevance",
    value=0.85,  # 0-1 scale
    comment="Response addresses query but lacks depth"
)

trace.score(
    name="factuality",
    value=0.92,
    data_type="NUMERIC"
)
```

## Automated Scoring with G-Eval

```python
# Use G-Eval for automated scoring
from app.shared.services.g_eval import GEvalScorer

scorer = GEvalScorer()
scores = await scorer.score(
    query=user_query,
    response=llm_response,
    criteria=["relevance", "coherence", "depth"]
)

for criterion, score in scores.items():
    trace.score(name=criterion, value=score)
```

## Scores Dashboard

View in Langfuse UI:
- **Score distributions** - Histogram of scores by criterion
- **Quality trends** - Track scores over time
- **Filter by threshold** - Show only low-scoring traces
- **Compare prompts** - Which prompt version scores higher?

## Quality Scores Trend Query

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

## Datasets for Evaluation

Create test datasets in Langfuse UI and run automated evaluations:

```python
# Fetch dataset
dataset = langfuse.get_dataset("security_audit_test_set")

# Run evaluation
for item in dataset.items:
    # Run LLM
    response = await llm.generate(item.input)

    # Create observation linked to dataset item
    langfuse.trace(
        name="evaluation_run",
        metadata={"dataset_item_id": item.id}
    ).generation(
        input=item.input,
        output=response,
        usage=response.usage
    )

    # Score
    score = await evaluate_response(item.expected_output, response)
    langfuse.score(
        trace_id=trace.id,
        name="accuracy",
        value=score
    )
```

## Dataset Structure in UI

```
security_audit_test_set
├── item_1: XSS vulnerability test
│   ├── input: "Check this HTML for XSS..."
│   └── expected_output: "Found XSS in innerHTML..."
├── item_2: SQL injection test
│   ├── input: "Review this SQL query..."
│   └── expected_output: "SQL injection vulnerability in WHERE clause..."
└── item_3: CSRF protection test
    ├── input: "Analyze this form..."
    └── expected_output: "Missing CSRF token..."
```

## Evaluation Metrics

Common score types:

| Metric | Range | Description |
|--------|-------|-------------|
| **Relevance** | 0-1 | Does response address the query? |
| **Coherence** | 0-1 | Is response logically structured? |
| **Depth** | 0-1 | Level of detail and analysis |
| **Factuality** | 0-1 | Accuracy of claims |
| **Completeness** | 0-1 | All aspects of query covered? |
| **Toxicity** | 0-1 | Harmful or inappropriate content |

## Best Practices

1. **Score all production traces** for quality monitoring
2. **Use consistent criteria** across all evaluations
3. **Automate scoring** with G-Eval or similar
4. **Set quality thresholds** (e.g., avg_relevance > 0.7)
5. **Create test datasets** for regression testing
6. **Track scores by prompt version** to measure improvements
7. **Alert on quality drops** (e.g., avg_score < 0.6 for 3 days)

## Integration with SkillForge Quality Gate

```python
# backend/app/workflows/nodes/quality_gate_node.py
from app.shared.services.langfuse import langfuse_client

async def quality_gate_node(state: WorkflowState):
    """Quality gate with Langfuse scoring."""

    # Get scores from evaluators
    scores = await run_quality_evaluators(state)

    # Log to Langfuse
    trace = langfuse_client.trace(
        name="quality_gate",
        session_id=f"analysis_{state['analysis_id']}"
    )

    for criterion, score in scores.items():
        trace.score(name=criterion, value=score)

    # Check threshold
    avg_score = sum(scores.values()) / len(scores)
    passed = avg_score >= 0.7

    return {"quality_gate_passed": passed, "quality_scores": scores}
```

## References

- [Langfuse Scores](https://langfuse.com/docs/scores)
- [Datasets Guide](https://langfuse.com/docs/datasets)
- [Model-Based Evaluation](https://langfuse.com/docs/scores-and-evaluation/model-based-evaluation)
