# LLM Evaluation & Scoring

Track quality metrics with custom scores, automated evaluation, and evaluator execution tracing.

## Basic Scoring (v3)

```python
from langfuse import observe, get_client, Langfuse

langfuse = Langfuse()

@observe()
async def analyze_and_score(query: str):
    """Run analysis and score the result."""
    response = await llm.generate(query)

    # Score via get_client() within @observe context
    get_client().update_current_observation(
        output=response[:500],
    )

    # Score the trace
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

## Evaluator Execution Tracing

In v3, each evaluator run creates its own inspectable trace:

```python
from langfuse import observe, get_client

@observe(type="evaluator", name="relevance_judge")
async def evaluate_relevance(query: str, response: str):
    """Each evaluator call creates an inspectable trace in Langfuse."""
    score = await llm_judge.evaluate(
        criteria="relevance",
        query=query,
        response=response,
    )

    get_client().update_current_observation(
        input={"query": query[:500], "response": response[:500]},
        output={"score": score, "criteria": "relevance"},
        model="claude-sonnet-4-6",
    )

    # The evaluator's own LLM calls are visible in its trace
    return score
```

Result in Langfuse UI:
```
evaluator:relevance_judge (0.8s, $0.01)
├── generation: judge_prompt → score: 0.85
└── metadata: {criteria: "relevance", model: "claude-sonnet-4-6"}
```

## Score Analytics

View multi-score comparisons in the Langfuse dashboard:

- **Score distributions**: Histogram of scores by criterion
- **Multi-score comparison**: Side-by-side comparison of relevance, depth, accuracy
- **Quality trends**: Track scores over time
- **Filter by threshold**: Show only low-scoring traces
- **Compare prompts**: Which prompt version scores higher?

## Mutable Score Configs

Configure score types and ranges in Langfuse settings:

```python
# Score configs can be updated without code changes
# In Langfuse UI: Settings → Score Configs

# Numeric scores
langfuse.score(trace_id="...", name="relevance", value=0.85, data_type="NUMERIC")

# Categorical scores
langfuse.score(trace_id="...", name="sentiment", value="positive", data_type="CATEGORICAL")

# Boolean scores
langfuse.score(trace_id="...", name="contains_pii", value=0, data_type="BOOLEAN")
```

## Automated Scoring with G-Eval

```python
from langfuse import observe, get_client
from app.shared.services.g_eval import GEvalScorer

scorer = GEvalScorer()

@observe()
async def analyze_with_scoring(query: str):
    response = await llm.generate(query)

    # Run G-Eval scoring
    scores = await scorer.score(
        query=query,
        response=response,
        criteria=["relevance", "coherence", "depth"],
    )

    # Record all scores
    for criterion, score in scores.items():
        get_client().score_current_trace(name=criterion, value=score)

    return response
```

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

Create test datasets and run automated evaluations:

```python
from langfuse import Langfuse, observe, get_client

langfuse = Langfuse()

# Fetch dataset
dataset = langfuse.get_dataset("security_audit_test_set")

@observe()
async def evaluate_item(item):
    """Evaluate a single dataset item with tracing."""
    response = await llm.generate(item.input)

    get_client().update_current_observation(
        input=item.input,
        output=response,
    )

    # Score
    score = await evaluate_response(item.expected_output, response)
    get_client().score_current_trace(name="accuracy", value=score)

    return score

# Run evaluation
for item in dataset.items:
    await evaluate_item(item)
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
2. **Use evaluator type** (`@observe(type="evaluator")`) for inspectable judge traces
3. **Use consistent criteria** across all evaluations
4. **Automate scoring** with G-Eval or similar
5. **Set quality thresholds** (e.g., avg_relevance > 0.7)
6. **Create test datasets** for regression testing
7. **Track scores by prompt version** to measure improvements
8. **Alert on quality drops** (e.g., avg_score < 0.6 for 3 days)

## Integration with OrchestKit Quality Gate

```python
from langfuse import observe, get_client

@observe(name="quality_gate")
async def quality_gate_node(state: WorkflowState):
    """Quality gate with Langfuse scoring."""

    # Get scores from evaluators
    scores = await run_quality_evaluators(state)

    # Log scores to trace
    for criterion, score in scores.items():
        get_client().score_current_trace(name=criterion, value=score)

    # Check threshold
    avg_score = sum(scores.values()) / len(scores)
    passed = avg_score >= 0.7

    return {"quality_gate_passed": passed, "quality_scores": scores}
```

## References

- [Langfuse Scores](https://langfuse.com/docs/scores)
- [Evaluator Tracing](https://langfuse.com/docs/scores-and-evaluation/evaluator-tracing)
- [Score Analytics](https://langfuse.com/docs/analytics/scores)
- [Datasets Guide](https://langfuse.com/docs/datasets)
